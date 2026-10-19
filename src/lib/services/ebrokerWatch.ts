/**
 * Daily watch over the public eBrokerPartner catalog.
 *
 * Reads the catalog, compares it with the stored snapshot (EbrokerCampaign) and
 * raises admin notifications (plus one e-mail digest) for:
 *   - a new personal/business account campaign          (EBROKER_NEW_CAMPAIGN)
 *   - a changed description/name of a watched campaign   (EBROKER_CAMPAIGN_CHANGED)
 *   - a watched campaign that disappeared                (EBROKER_CAMPAIGN_REMOVED)
 *   - a promotion past its deadline whose campaign is still listed, i.e. a
 *     possible extension or new edition                  (PROMOTION_CHECK_NEEDED)
 *
 * It NEVER creates, extends or expires a promotion by itself: the catalog has no
 * dates or edition data, so every signal is a prompt to check the bank's own
 * regulamin. Creating the promotion content is a separate step (see
 * scripts/ebroker-pending.ts and scripts/add-promotion-with-checklist.ts).
 */
import type { PrismaClient, AdminNotificationType } from "@prisma/client";
import {
  contentHash,
  diffCatalog,
  isWatchedOffer,
  parseCatalogXml,
  type CatalogOffer
} from "@/lib/ebrokerCatalog";
import { isDeadlinePassed } from "@/lib/promotionAvailability";

export type WatchResult = {
  baseline: boolean;
  offers: number;
  watched: number;
  added: string[];
  changed: string[];
  newlyMissing: string[];
  returned: string[];
  checkNeeded: string[];
  suspectIncomplete: boolean;
  notificationsCreated: number;
  pendingWithoutPromotion: string[];
};

type NewNotification = {
  type: AdminNotificationType;
  title: string;
  body: string;
  dedupKey: string;
  relatedPromotionId?: string;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function runEbrokerWatch(
  db: PrismaClient,
  fetchXml: () => Promise<string>,
  now: Date = new Date()
): Promise<{ result: WatchResult; notifications: NewNotification[] }> {
  const offers = parseCatalogXml(await fetchXml());
  const stored = await db.ebrokerCampaign.findMany();
  const baseline = stored.length === 0;
  const diff = diffCatalog(stored, offers);
  const byOid = new Map(offers.map((o) => [o.oid, o]));
  const storedByOid = new Map(stored.map((s) => [s.oid, s]));

  // 1. Persist the snapshot. New campaigns are inserted even in a broken read;
  //    "missing" marks are written only for a trustworthy catalog.
  for (const o of offers) {
    const watched = isWatchedOffer(o);
    const data = {
      name: o.name,
      institution: o.institution,
      category: o.category,
      subcategory: o.subcategory,
      description: o.description,
      trackingUrl: o.trackingUrl,
      contentHash: contentHash(o),
      watched,
      lastSeenAt: now,
      missingSince: null
    };
    await db.ebrokerCampaign.upsert({ where: { oid: o.oid }, create: { oid: o.oid, ...data }, update: data });
  }
  if (!diff.suspectIncomplete) {
    for (const oid of diff.newlyMissing) {
      await db.ebrokerCampaign.update({ where: { oid }, data: { missingSince: now } });
    }
  }

  // 2. Notifications.
  const list: NewNotification[] = [];
  const label = (o: Pick<CatalogOffer, "institution" | "name" | "oid">) => `${o.institution} — ${o.name} (oid ${o.oid})`;

  if (!baseline) {
    for (const o of diff.added) {
      list.push({
        type: "EBROKER_NEW_CAMPAIGN",
        title: `Nowa kampania w eBroker: ${o.institution}`,
        body: `${label(o)}. ${o.description.slice(0, 200)}`,
        dedupKey: `ebroker-new:${o.oid}`
      });
    }
    for (const o of diff.changed) {
      const prev = storedByOid.get(o.oid);
      list.push({
        type: "EBROKER_CAMPAIGN_CHANGED",
        title: `Zmiana opisu kampanii: ${o.institution}`,
        body: `${label(o)}. Nowy opis: ${o.description.slice(0, 200)}`,
        dedupKey: `ebroker-changed:${o.oid}:${contentHash(o).slice(0, 12)}`,
        relatedPromotionId: prev?.promotionId ?? undefined
      });
    }
    for (const oid of diff.newlyMissing) {
      const s = storedByOid.get(oid)!;
      list.push({
        type: "EBROKER_CAMPAIGN_REMOVED",
        title: `Kampania zniknęła z katalogu eBroker: ${s.institution}`,
        body: `${s.institution} — ${s.name} (oid ${oid}) nie ma w dzisiejszym katalogu. To nie znaczy, że promocja się skończyła — sprawdź na stronie banku.`,
        dedupKey: `ebroker-removed:${oid}:${isoDay(now)}`,
        relatedPromotionId: s.promotionId ?? undefined
      });
    }
  }
  if (diff.suspectIncomplete) {
    list.push({
      type: "EBROKER_CAMPAIGN_REMOVED",
      title: "Katalog eBroker wygląda na niepełny",
      body: "Dzisiejszy katalog ma znacznie mniej kampanii niż zwykle, więc nie oznaczam żadnej jako usuniętej. Sprawdź, czy eBroker nie zmienił formatu.",
      dedupKey: `ebroker-incomplete:${isoDay(now)}`
    });
  }

  // 3. Promotions past their deadline whose campaign is still in the catalog.
  const linked = await db.ebrokerCampaign.findMany({
    where: { promotionId: { not: null }, ignored: false, missingSince: null },
    select: { oid: true, name: true, institution: true, promotionId: true }
  });
  const promos = await db.promotion.findMany({
    where: { id: { in: linked.map((c) => c.promotionId!).filter(Boolean) } },
    select: { id: true, name: true, slug: true, status: true, endDate: true }
  });
  const promoById = new Map(promos.map((p) => [p.id, p]));
  const checkNeeded: string[] = [];
  for (const c of linked) {
    const p = promoById.get(c.promotionId!);
    if (!p || !isDeadlinePassed(p.endDate, now) || p.status === "ARCHIVED") continue;
    // Only campaigns that are still in today's catalog count as "still offered".
    if (!byOid.has(c.oid)) continue;
    checkNeeded.push(p.slug);
    list.push({
      type: "PROMOTION_CHECK_NEEDED",
      title: `Czy promocja nie została przedłużona? ${c.institution}`,
      body: `„${p.name}” skończyła się ${isoDay(p.endDate)}, a kampania (oid ${c.oid}) nadal jest w katalogu eBroker. Sprawdź regulamin banku: nowa edycja albo przedłużenie.`,
      dedupKey: `promo-check:${p.id}:${isoDay(p.endDate)}`,
      relatedPromotionId: p.id
    });
  }

  const fresh: NewNotification[] = [];
  for (const n of list) {
    try {
      await db.adminNotification.create({ data: n });
      fresh.push(n);
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // already raised on an earlier run
    }
  }

  const pending = await db.ebrokerCampaign.findMany({
    where: { watched: true, ignored: false, promotionId: null, skipReason: null, missingSince: null },
    select: { oid: true },
    orderBy: { oid: "asc" }
  });

  return {
    result: {
      baseline,
      offers: offers.length,
      watched: offers.filter(isWatchedOffer).length,
      added: diff.added.map((o) => o.oid),
      changed: diff.changed.map((o) => o.oid),
      newlyMissing: diff.newlyMissing,
      returned: diff.returned,
      checkNeeded,
      suspectIncomplete: diff.suspectIncomplete,
      notificationsCreated: fresh.length,
      pendingWithoutPromotion: pending.map((p) => p.oid)
    },
    notifications: fresh
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The e-mail of EVERY daily run: what was checked and what was found, also when nothing changed ("bez zmian"),
 * so the owner can tell that the check ran. With findings it lists them like watchDigestEmail.
 */
export function watchDailyReport(
  result: Pick<WatchResult, "baseline" | "offers" | "watched" | "added" | "changed" | "newlyMissing" | "returned" | "checkNeeded">,
  items: NewNotification[],
  adminUrl: string
): { subject: string; html: string } {
  const quiet = items.length === 0;
  const subject = quiet
    ? "Bankmiplaci: dzienna kontrola eBroker - bez zmian"
    : `Bankmiplaci: dzienna kontrola eBroker - ${items.length} ${items.length === 1 ? "zmiana" : "zmian(y)"}`;
  const summary = `<p>Sprawdzono katalog eBrokerPartner: ${result.offers} ofert, z czego ${result.watched} to konta (osobiste i firmowe).${
    result.baseline ? " To pierwsze uruchomienie - zapisano stan wyjściowy, zmiany będą wykrywane od następnego dnia." : ""
  }</p>`;
  const counts = `<p style="color:#444">Nowe: ${result.added.length} · zmienione: ${result.changed.length} · zniknęły: ${result.newlyMissing.length} · wróciły: ${result.returned.length} · do sprawdzenia po terminie: ${result.checkNeeded.length}</p>`;
  const rows = items.map((n) => `<li><strong>${esc(n.title)}</strong><br>${esc(n.body)}</li>`).join("");
  const body = quiet ? "<p>Nic się nie zmieniło od poprzedniej kontroli.</p>" : `<p>Co ustalono:</p><ul>${rows}</ul>`;
  const html = `${summary}${counts}${body}<p><a href="${esc(adminUrl)}">Otwórz panel admina</a></p><p style="color:#666;font-size:12px">Katalog eBroker nie zawiera dat ani edycji promocji - każda zmiana wymaga sprawdzenia regulaminu banku.</p>`;
  return { subject, html };
}

/** One digest e-mail for everything raised in a run. */
export function watchDigestEmail(items: NewNotification[], adminUrl: string): { subject: string; html: string } {
  const subject =
    items.length === 1 ? `Bankmiplaci: ${items[0]!.title}` : `Bankmiplaci: ${items.length} zmian w ofertach banków`;
  const rows = items
    .map((n) => `<li><strong>${esc(n.title)}</strong><br>${esc(n.body)}</li>`)
    .join("");
  const html = `<p>Dzienna kontrola ofert eBrokerPartner wykryła zmiany:</p><ul>${rows}</ul><p><a href="${esc(
    adminUrl
  )}">Otwórz panel admina</a></p><p style="color:#666;font-size:12px">Katalog eBroker nie zawiera dat ani edycji promocji — każda zmiana wymaga sprawdzenia regulaminu banku.</p>`;
  return { subject, html };
}
