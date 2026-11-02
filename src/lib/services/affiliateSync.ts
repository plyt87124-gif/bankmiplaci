/**
 * Daily affiliate sync: what the agent read in a network's partner panel
 * (one JSON snapshot per network, see SnapshotSchema) goes into the
 * affiliate_* tables, every difference against the previous reading becomes
 * an AffiliateChange row (the source of the daily e-mail), and each
 * promotion's link is pointed at the network that pays more for a new client
 * (src/lib/affiliateNetworks.ts decides).
 *
 * Driven by scripts/affiliate-sync.ts. Dry-run by default: the same changes
 * are computed and returned, nothing is written.
 *
 * The panels are read in a browser by the agent, so a reading can be partial
 * (session expired half way): "missing" is only concluded for a section the
 * snapshot marks as complete.
 */
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  applicationStage,
  chooseAffiliateLink,
  NETWORK_LABEL,
  offerCommissionCents,
  STAGE_LABEL,
  type ApplicationStage,
  type Network
} from "@/lib/affiliateNetworks";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data RRRR-MM-DD");
const cents = z.number().int().nonnegative();

const OfferSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  bankName: z.string().min(1),
  category: z.string().min(1),
  cpsCents: cents.nullable().optional(),
  cpaCents: cents.nullable().optional(),
  conditions: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  newClientOnly: z.boolean().nullable().optional(),
  ownApplicationsAllowed: z.boolean().nullable().optional(),
  ownApplicationsNote: z.string().nullable().optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  trackingUrl: z.string().url().nullable().optional(),
  detailUrl: z.string().url().nullable().optional(),
  // Slug of the promotion on this site the campaign is for (agent's match).
  promotionSlug: z.string().min(1).nullable().optional()
});

const TierSchema = z.union([
  z.object({ everyN: z.number().int().positive(), bonusCents: cents.positive() }),
  z.object({ atLeast: z.number().int().positive(), bonusCents: cents.positive() })
]);

const ContestSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  tiers: z.array(TierSchema).default([]),
  offerExternalIds: z.array(z.string()).default([]),
  sourceUrl: z.string().url().nullable().optional()
});

const ApplicationSchema = z.object({
  externalId: z.string().min(1),
  openedAt: z.string().min(10),
  bankName: z.string().min(1),
  productName: z.string().min(1),
  commissionModel: z.string().nullable().optional(),
  amountCents: cents.nullable().optional(),
  status: z.string().min(1),
  settledAt: day.nullable().optional(),
  paidAt: day.nullable().optional()
});

export const SnapshotSchema = z.object({
  network: z.enum(["EBROKER", "COMPERIA"]),
  readAt: z.string().min(10),
  // Which sections were read in full. A section that is not complete is
  // still upserted, but nothing absent from it is marked as gone.
  complete: z.object({ offers: z.boolean(), contests: z.boolean(), applications: z.boolean() }),
  offers: z.array(OfferSchema).default([]),
  contests: z.array(ContestSchema).default([]),
  applications: z.array(ApplicationSchema).default([])
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export interface ChangeDraft {
  network: Network | null;
  kind: string;
  title: string;
  details: Record<string, unknown>;
  promotionId?: string | null;
}

const zl = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`);
const toDate = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00.000Z`) : null);
const hash = (...parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Resolves the promotion an offer belongs to (the agent's slug, else the eBroker
 * catalog link by oid) and, for eBroker, the catalog's partner link: the same
 * link every eBroker promotion already uses, so it is the default trackingUrl.
 */
async function resolvePromotionIds(db: Db, snap: Snapshot): Promise<Map<string, { promotionId: string | null; catalogUrl: string | null }>> {
  const slugs = [...new Set(snap.offers.map((o) => o.promotionSlug).filter((s): s is string => !!s))];
  const promos = slugs.length ? await db.promotion.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } }) : [];
  const bySlug = new Map(promos.map((p) => [p.slug, p.id]));
  const unknown = slugs.filter((s) => !bySlug.has(s));
  if (unknown.length) throw new Error(`Nieznane promotionSlug: ${unknown.join(", ")}`);

  const campaigns =
    snap.network === "EBROKER"
      ? await db.ebrokerCampaign.findMany({
          where: { oid: { in: snap.offers.map((o) => o.externalId) } },
          select: { oid: true, promotionId: true, trackingUrl: true }
        })
      : [];
  const byOid = new Map(campaigns.map((c) => [c.oid, c]));

  const result = new Map<string, { promotionId: string | null; catalogUrl: string | null }>();
  for (const o of snap.offers) {
    const campaign = byOid.get(o.externalId);
    result.set(o.externalId, {
      promotionId: o.promotionSlug ? bySlug.get(o.promotionSlug)! : campaign?.promotionId ?? null,
      catalogUrl: campaign?.trackingUrl ?? null
    });
  }
  return result;
}

/**
 * Compares one network's snapshot with the stored state; with `apply` also
 * writes it. Returns every change found (also in dry-run).
 */
export async function syncSnapshot(db: PrismaClient, raw: unknown, opts: { apply: boolean; now?: Date }): Promise<ChangeDraft[]> {
  const snap = SnapshotSchema.parse(raw);
  const now = opts.now ?? new Date();
  const network = snap.network as Network;
  const label = NETWORK_LABEL[network];
  const changes: ChangeDraft[] = [];
  const writes: ((tx: Prisma.TransactionClient) => Promise<unknown>)[] = [];

  // ---- offers ----
  const promotionIds = await resolvePromotionIds(db, snap);
  const storedOffers = await db.affiliateOffer.findMany({ where: { network } });
  const storedById = new Map(storedOffers.map((o) => [o.externalId, o]));
  const seenOffers = new Set<string>();

  for (const o of snap.offers) {
    seenOffers.add(o.externalId);
    const prev = storedById.get(o.externalId);
    const resolved = promotionIds.get(o.externalId);
    const promotionId = resolved?.promotionId ?? prev?.promotionId ?? null;
    const data = {
      name: o.name,
      bankName: o.bankName,
      category: o.category,
      cpsCents: o.cpsCents ?? null,
      cpaCents: o.cpaCents ?? null,
      conditions: o.conditions ?? null,
      notes: o.notes ?? null,
      newClientOnly: o.newClientOnly ?? null,
      ownApplicationsAllowed: o.ownApplicationsAllowed ?? null,
      ownApplicationsNote: o.ownApplicationsNote ?? null,
      startDate: toDate(o.startDate),
      endDate: toDate(o.endDate),
      trackingUrl: o.trackingUrl ?? resolved?.catalogUrl ?? null,
      detailUrl: o.detailUrl ?? null,
      promotionId,
      contentHash: hash(o.name, o.conditions ?? null, o.notes ?? null, o.ownApplicationsAllowed ?? null, o.startDate ?? null, o.endDate ?? null),
      lastSeenAt: now,
      missingSince: null
    };
    const rates = `CPS ${zl(data.cpsCents)} / CPA ${zl(data.cpaCents)}`;
    if (!prev) {
      changes.push({ network, kind: "OFFER_NEW", title: `${label}: nowa kampania ${o.bankName} – ${o.name} (${rates})`, details: { externalId: o.externalId, ...data }, promotionId });
      writes.push((tx) => tx.affiliateOffer.create({ data: { network, externalId: o.externalId, ...data, firstSeenAt: now } }));
      continue;
    }
    if (prev.missingSince) {
      changes.push({ network, kind: "OFFER_RETURNED", title: `${label}: kampania wróciła ${o.bankName} – ${o.name}`, details: { externalId: o.externalId }, promotionId });
    }
    if (prev.cpsCents !== data.cpsCents || prev.cpaCents !== data.cpaCents) {
      changes.push({
        network,
        kind: "RATE_CHANGED",
        title: `${label}: zmiana stawki ${o.bankName} – ${o.name}: CPS ${zl(prev.cpsCents)} → ${zl(data.cpsCents)}, CPA ${zl(prev.cpaCents)} → ${zl(data.cpaCents)}`,
        details: { externalId: o.externalId, before: { cpsCents: prev.cpsCents, cpaCents: prev.cpaCents }, after: { cpsCents: data.cpsCents, cpaCents: data.cpaCents } },
        promotionId
      });
    }
    if (prev.contentHash !== data.contentHash) {
      changes.push({
        network,
        kind: "TERMS_CHANGED",
        title: `${label}: zmienione warunki/opis ${o.bankName} – ${o.name}`,
        details: { externalId: o.externalId, before: { conditions: prev.conditions, notes: prev.notes, endDate: prev.endDate }, after: { conditions: data.conditions, notes: data.notes, endDate: data.endDate } },
        promotionId
      });
    }
    writes.push((tx) => tx.affiliateOffer.update({ where: { id: prev.id }, data }));
  }
  if (snap.complete.offers) {
    for (const prev of storedOffers) {
      if (seenOffers.has(prev.externalId) || prev.missingSince) continue;
      changes.push({ network, kind: "OFFER_GONE", title: `${label}: kampanii nie ma już w panelu – ${prev.bankName} – ${prev.name}`, details: { externalId: prev.externalId }, promotionId: prev.promotionId });
      writes.push((tx) => tx.affiliateOffer.update({ where: { id: prev.id }, data: { missingSince: now } }));
    }
  }

  // ---- contests ----
  const storedContests = await db.affiliateContest.findMany({ where: { network } });
  const contestById = new Map(storedContests.map((c) => [c.externalId, c]));
  const seenContests = new Set<string>();
  for (const c of snap.contests) {
    seenContests.add(c.externalId);
    const prev = contestById.get(c.externalId);
    const data = {
      title: c.title,
      description: c.description ?? null,
      startDate: toDate(c.startDate),
      endDate: toDate(c.endDate),
      tiers: c.tiers as Prisma.InputJsonValue,
      offerExternalIds: c.offerExternalIds,
      sourceUrl: c.sourceUrl ?? null,
      contentHash: hash(c.title, c.description ?? null, c.startDate ?? null, c.endDate ?? null, c.tiers, [...c.offerExternalIds].sort()),
      lastSeenAt: now,
      missingSince: null
    };
    if (!prev) {
      changes.push({ network, kind: "CONTEST_NEW", title: `${label}: nowy konkurs – ${c.title}`, details: { externalId: c.externalId, ...data } });
      writes.push((tx) => tx.affiliateContest.create({ data: { network, externalId: c.externalId, ...data, firstSeenAt: now } }));
      continue;
    }
    if (prev.contentHash !== data.contentHash) {
      changes.push({ network, kind: "CONTEST_CHANGED", title: `${label}: zmieniony konkurs – ${c.title}`, details: { externalId: c.externalId, before: { tiers: prev.tiers, endDate: prev.endDate }, after: { tiers: data.tiers, endDate: data.endDate } } });
    }
    writes.push((tx) => tx.affiliateContest.update({ where: { id: prev.id }, data }));
  }
  if (snap.complete.contests) {
    for (const prev of storedContests) {
      if (seenContests.has(prev.externalId) || prev.missingSince) continue;
      changes.push({ network, kind: "CONTEST_GONE", title: `${label}: konkurs zniknął z panelu – ${prev.title}`, details: { externalId: prev.externalId } });
      writes.push((tx) => tx.affiliateContest.update({ where: { id: prev.id }, data: { missingSince: now } }));
    }
  }

  // ---- applications ----
  const storedApps = await db.affiliateApplication.findMany({
    where: { network, externalId: { in: snap.applications.map((a) => a.externalId) } }
  });
  const appById = new Map(storedApps.map((a) => [a.externalId, a]));
  for (const a of snap.applications) {
    const stage = applicationStage(a.status);
    const prev = appById.get(a.externalId);
    const data = {
      openedAt: new Date(a.openedAt),
      bankName: a.bankName,
      productName: a.productName,
      commissionModel: a.commissionModel ?? null,
      amountCents: a.amountCents ?? null,
      status: a.status,
      stage,
      settledAt: toDate(a.settledAt),
      paidAt: toDate(a.paidAt)
    };
    const what = `${a.bankName} – ${a.productName}`;
    if (!prev) {
      // Bare clicks are counted in the report, not listed one by one.
      if (stage !== "CLICK") {
        changes.push({ network, kind: stage === "PAID" ? "PAYOUT" : "APPLICATION_NEW", title: `${label}: wniosek ${a.externalId} (${what}) – ${STAGE_LABEL[stage]}${a.amountCents != null ? `, ${zl(a.amountCents)}` : ""}`, details: { externalId: a.externalId, stage, amountCents: data.amountCents } });
      }
      writes.push((tx) => tx.affiliateApplication.create({ data: { network, externalId: a.externalId, ...data, firstSeenAt: now, stageChangedAt: now } }));
      continue;
    }
    if (prev.stage !== stage) {
      changes.push({
        network,
        kind: stage === "PAID" ? "PAYOUT" : "APPLICATION_STAGE",
        title: `${label}: wniosek ${a.externalId} (${what}): ${STAGE_LABEL[prev.stage as ApplicationStage] ?? prev.stage} → ${STAGE_LABEL[stage]}${a.amountCents != null ? `, ${zl(a.amountCents)}` : ""}`,
        details: { externalId: a.externalId, from: prev.stage, to: stage, amountCents: data.amountCents }
      });
      writes.push((tx) => tx.affiliateApplication.update({ where: { id: prev.id }, data: { ...data, stageChangedAt: now } }));
    } else {
      writes.push((tx) => tx.affiliateApplication.update({ where: { id: prev.id }, data }));
    }
  }

  if (opts.apply) {
    await db.$transaction(
      async (tx) => {
        for (const w of writes) await w(tx);
        if (changes.length) await tx.affiliateChange.createMany({ data: changes.map(toRow) });
      },
      { timeout: 60_000 }
    );
  }
  return changes;
}

function toRow(c: ChangeDraft): Prisma.AffiliateChangeCreateManyInput {
  return {
    network: c.network,
    kind: c.kind,
    title: c.title,
    details: JSON.parse(JSON.stringify(c.details)) as Prisma.InputJsonValue,
    promotionId: c.promotionId ?? null
  };
}

/**
 * Points every promotion that has campaigns in the affiliate tables at the
 * better-paying network (see chooseAffiliateLink). A switch rewrites
 * affiliateUrl, affiliateNetwork and affiliateCommissionCents and is logged
 * with the previous link, so it can be undone from /admin/prowizje.
 * Undecidable cases are logged as DECISION_NEEDED (once per promotion and day).
 */
export async function chooseLinks(db: PrismaClient, opts: { apply: boolean; now?: Date }): Promise<ChangeDraft[]> {
  const now = opts.now ?? new Date();
  const promotions = await db.promotion.findMany({
    where: { affiliateOffers: { some: {} }, status: { in: ["ACTIVE", "DRAFT"] } },
    select: {
      id: true,
      slug: true,
      name: true,
      affiliateUrl: true,
      affiliateNetwork: true,
      affiliateNetworkPinned: true,
      affiliateCommissionCents: true,
      bank: { select: { name: true } },
      affiliateOffers: true
    }
  });

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const askedToday = new Set(
    (
      await db.affiliateChange.findMany({
        where: { kind: "DECISION_NEEDED", createdAt: { gte: dayStart } },
        select: { promotionId: true }
      })
    ).map((c) => c.promotionId)
  );

  const changes: ChangeDraft[] = [];
  for (const p of promotions) {
    const choice = chooseAffiliateLink(p, p.affiliateOffers, now);
    const what = `${p.bank.name} – ${p.name}`;
    if (choice.kind === "switch") {
      const to = choice.to;
      const change: ChangeDraft = {
        network: to.network,
        kind: "LINK_SWITCHED",
        title: `Link „Przejdź do promocji” ${what}: ${choice.from ? NETWORK_LABEL[choice.from] : "?"} → ${NETWORK_LABEL[to.network]} (${choice.model} ${zl(choice.fromCents)} → ${zl(choice.toCents)})`,
        details: {
          slug: p.slug,
          model: choice.model,
          before: { affiliateUrl: p.affiliateUrl, affiliateNetwork: p.affiliateNetwork, affiliateCommissionCents: p.affiliateCommissionCents },
          after: { affiliateUrl: to.trackingUrl, affiliateNetwork: to.network, affiliateCommissionCents: choice.toCents }
        },
        promotionId: p.id
      };
      changes.push(change);
      if (opts.apply) {
        await db.$transaction([
          db.promotion.update({
            where: { id: p.id },
            data: { affiliateUrl: to.trackingUrl!, affiliateNetwork: to.network, affiliateCommissionCents: offerCommissionCents(to, choice.model) }
          }),
          db.affiliateChange.create({ data: toRow(change) })
        ]);
      }
    } else if (choice.kind === "decide") {
      if (askedToday.has(p.id)) continue;
      const change: ChangeDraft = { network: null, kind: "DECISION_NEEDED", title: `❓ ${what}: ${choice.reason}`, details: { slug: p.slug, reason: choice.reason }, promotionId: p.id };
      changes.push(change);
      if (opts.apply) await db.affiliateChange.create({ data: toRow(change) });
    } else if (choice.network && p.affiliateNetwork !== choice.network && opts.apply) {
      // Quiet backfill: the link's network is known from its host.
      await db.promotion.update({ where: { id: p.id }, data: { affiliateNetwork: choice.network } });
    }
  }
  return changes;
}

/** Undo of one LINK_SWITCHED change: restores the link it replaced and pins the promotion to it. */
export async function revertLinkSwitch(db: PrismaClient, changeId: string): Promise<void> {
  const change = await db.affiliateChange.findUnique({ where: { id: changeId } });
  if (!change || change.kind !== "LINK_SWITCHED" || !change.promotionId) throw new Error("To nie jest zmiana linku.");
  const before = (change.details as { before?: { affiliateUrl?: string; affiliateNetwork?: Network | null; affiliateCommissionCents?: number | null } }).before;
  if (!before?.affiliateUrl) throw new Error("Brak poprzedniego linku w historii.");
  await db.$transaction([
    db.promotion.update({
      where: { id: change.promotionId },
      data: {
        affiliateUrl: before.affiliateUrl,
        affiliateNetwork: before.affiliateNetwork ?? null,
        affiliateCommissionCents: before.affiliateCommissionCents ?? null,
        affiliateNetworkPinned: true
      }
    }),
    db.affiliateChange.create({
      data: {
        network: before.affiliateNetwork ?? null,
        kind: "LINK_REVERTED",
        title: `Cofnięto zmianę linku (ręcznie w adminie): ${change.title}`,
        details: { revertedChangeId: change.id },
        promotionId: change.promotionId
      }
    })
  ]);
}
