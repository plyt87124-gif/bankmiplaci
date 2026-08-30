import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPromotionBySlug } from "@/lib/services/promotions";
import { formatPLN, formatDate, DIFFICULTY_LABEL, DIFFICULTY_EFFORT, isExpired } from "@/lib/format";
import { outboundHref } from "@/lib/affiliate";
import { Badge } from "@/components/ui/Badge";
import { EffortMeter } from "@/components/ui/EffortMeter";
import { ButtonLink } from "@/components/ui/Button";
import { AffiliateCtaLink } from "@/components/AffiliateCtaLink";
import { ConditionsChecklist } from "@/components/ConditionsChecklist";
import { PromotionImpression } from "@/components/PromotionImpression";
import { PageViewTracker } from "@/components/PageViewTracker";
import { AttributionCapture } from "@/components/AttributionCapture";
import { PromotionComments } from "@/components/PromotionComments";
import { EligibilityBanner } from "@/components/EligibilityBanner";
import { ShareButton } from "@/components/ShareButton";
import { JoinChecklistButton } from "@/components/JoinChecklistButton";
import { getCurrentUser } from "@/lib/userSession";
import { db } from "@/lib/db";
import { computeEligibility } from "@/lib/services/eligibility";
import { AlertTriangle, ShieldAlert, Eye, ArrowRight, BookOpen } from "lucide-react";

interface PageProps {
  params: { slug: string };
  searchParams: { ref?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const promotion = await getPromotionBySlug(params.slug);
  if (!promotion) return { title: "Promocja nie znaleziona" };

  const title = `${promotion.bank.name} — do ${formatPLN(promotion.maxBonusCents)} premii`;
  const description =
    promotion.summary ??
    `Sprawdź warunki promocji ${promotion.name} banku ${promotion.bank.name}: wysokość premii, wymagania i koszty.`;

  return {
    title,
    description,
    alternates: { canonical: `/promocje/${promotion.slug}` },
    // Explicit images — a page-level openGraph object overrides (doesn't
    // merge with) the site-wide opengraph-image.tsx convention, so without
    // this the universal branded image silently disappears here.
    openGraph: { title, description, type: "article", images: ["/opengraph-image"] },
    // Draft/expired/archived promotions are only ever reachable via an
    // admin preview link — never let search engines index them.
    robots: promotion.status === "ACTIVE" ? { index: true, follow: true } : { index: false, follow: false }
  };
}

export default async function PromotionDetailPage({ params, searchParams }: PageProps) {
  const promotion = await getPromotionBySlug(params.slug);

  if (!promotion) notFound();

  if (promotion.status === "DRAFT") {
    const adminSession = await getServerSession(authOptions);
    if (!adminSession) notFound();
  }

  const currentUser = await getCurrentUser();
  const bankHistory = currentUser
    ? await db.userBankHistory.findUnique({
        where: {
          userId_bankId_accountType: {
            userId: currentUser.id,
            bankId: promotion.bankId,
            accountType: promotion.accountType
          }
        }
      })
    : null;
  const eligibility = computeEligibility(promotion.cooldownMonths, promotion.cooldownCutoffDate, bankHistory?.wasClientUntil);

  // Interactive month-by-month "cheat sheet" — only built out for one
  // promotion so far (see ChecklistStep seed data), expand later.
  const checklistStepCount = await db.checklistStep.count({ where: { promotionId: promotion.id } });

  // Deep-dive blog guide for this specific promotion, if one has been
  // written and linked (see Article.promotionId) — internal linking for
  // SEO, generalizes automatically to every future promotion+article pair.
  const relatedArticle = await db.article.findFirst({
    where: { promotionId: promotion.id, published: true },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, excerpt: true }
  });
  const promotionTracking = currentUser
    ? await db.userPromotionTracking.findUnique({
        where: { userId_promotionId: { userId: currentUser.id, promotionId: promotion.id } }
      })
    : null;

  const expired = promotion.status === "EXPIRED" || promotion.status === "ARCHIVED" || isExpired(promotion.endDate);
  const bonusPartsSum = promotion.bonusParts.reduce((sum, p) => sum + p.amountCents, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: `${promotion.bank.name} — ${promotion.name}`,
    provider: { "@type": "BankOrCreditUnion", name: promotion.bank.name },
    description: promotion.summary ?? undefined,
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/promocje/${promotion.slug}`
  };

  return (
    <div className="container-page py-10">
      <PageViewTracker />
      <AttributionCapture />
      <PromotionImpression promotionId={promotion.id} />
      <nav aria-label="breadcrumb" className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">
          Strona główna
        </Link>{" "}
        /{" "}
        <Link href="/promocje" className="hover:underline">
          Promocje
        </Link>{" "}
        / <span className="text-ink-700">{promotion.bank.name}</span>
      </nav>

      {currentUser && <EligibilityBanner result={eligibility} bankName={promotion.bank.name} accountType={promotion.accountType} />}

      {promotion.status === "DRAFT" && (
        <div className="mt-4 flex items-start gap-3 rounded-xl2 border border-gold-100 bg-gold-100/60 p-4">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
          <p className="text-sm text-ink-700">
            To jest <strong>podgląd administratora</strong> — ta promocja ma status „Wersja robocza" i nie jest
            widoczna publicznie ani indeksowana przez wyszukiwarki. Zobaczysz ją tylko Ty, będąc zalogowanym/ą
            do panelu.
          </p>
        </div>
      )}

      {expired && (
        <div className="mt-4 flex items-start gap-3 rounded-xl2 border border-coral-100 bg-coral-100/60 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral-600" />
          <p className="text-sm text-coral-600">
            Ta promocja nie jest już aktywna. Zostawiamy jej opis jako archiwalny — nie skorzystasz już z tej
            oferty na podanych warunkach.{" "}
            <Link href="/promocje" className="underline">
              Zobacz aktualne promocje
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_auto]">
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-ink-500">{promotion.bank.name}</p>
          </div>
          <h1 className="mt-1 text-3xl font-semibold">
            {promotion.bank.name} — do {formatPLN(promotion.maxBonusCents)} premii
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-medium text-ink-700">
              Ocena: {Number(promotion.rating).toFixed(1)}/10
            </span>
            <Badge tone="neutral">{DIFFICULTY_LABEL[promotion.difficulty]}</Badge>
          </div>
          {promotion.ratingReason && (
            <p className="mt-2 max-w-lg text-sm text-ink-500">
              {promotion.ratingReason} <span className="text-ink-300">— ocena serwisu, nie porada finansowa.</span>
            </p>
          )}

          {/* Key stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Premia", value: formatPLN(promotion.maxBonusCents) },
              { label: "Trudność", value: DIFFICULTY_LABEL[promotion.difficulty] },
              { label: "Koszt", value: promotion.fees && promotion.fees.accountFeeCents > 0 ? formatPLN(promotion.fees.accountFeeCents) : "0 zł*" },
              { label: "Koniec promocji", value: formatDate(promotion.endDate) }
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl2 border border-ink-100 bg-surface p-4">
                <p className="text-xs text-ink-500">{stat.label}</p>
                <p className="mt-1 font-display text-lg font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
          <EffortMeter level={DIFFICULTY_EFFORT[promotion.difficulty] as 1 | 2 | 3 | 4 | 5} className="mt-4" />
        </div>

        {/* Sticky CTA sidebar — placed right after the intro in DOM order so
            it appears here on mobile (single column) instead of at the very
            bottom under the comments; row-span keeps it sticking alongside
            the rest of the article on desktop's two-column layout. */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="rounded-xl2 border border-ink-100 bg-surface p-6 shadow-card">
            <p className="text-xs text-ink-500">Do</p>
            <p className="font-display text-3xl font-semibold">{formatPLN(promotion.maxBonusCents)}</p>
            <p className="mt-1 text-sm text-ink-500">{promotion.bank.name} · {DIFFICULTY_LABEL[promotion.difficulty]}</p>

            {expired ? (
              <ButtonLink href="/promocje" className="mt-5 w-full">
                Zobacz aktualne promocje
              </ButtonLink>
            ) : (
              <AffiliateCtaLink
                href={outboundHref(
                  promotion.slug,
                  searchParams.ref
                    ? { source: "eligibility-email", campaign: searchParams.ref }
                    : { source: "detail-cta" }
                )}
                size="lg"
                className="group mt-5 w-full text-base font-semibold shadow-cardHover"
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                prefetch={false}
              >
                Przejdź do promocji
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </AffiliateCtaLink>
            )}

            <ShareButton
              url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/promocje/${promotion.slug}`}
              title={`${promotion.bank.name} — do ${formatPLN(promotion.maxBonusCents)} premii`}
            />
          </div>

          {checklistStepCount > 0 && (
            <JoinChecklistButton
              promotionId={promotion.id}
              loggedIn={Boolean(currentUser)}
              // Mid-progress (joined, not finished yet) is independent of
              // eligibility — only matters once they've completed the
              // checklist. A completed tracking only stays "locked" while
              // the resulting karencja hasn't cleared yet; if the user is
              // eligible again (cooldown passed, or they corrected their
              // dates in Moje konto), let them start a fresh round instead.
              alreadyJoined={Boolean(promotionTracking) && !promotionTracking?.completedAt}
              locked={Boolean(promotionTracking?.completedAt) && eligibility.status !== "eligible"}
            />
          )}
        </aside>

        <div className="lg:col-start-1 lg:row-start-2">
          {/* Bonus breakdown */}
          {promotion.bonusParts.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold">Z czego składa się premia?</h2>
              <div className="mt-4 divide-y divide-ink-100 rounded-xl2 border border-ink-100 bg-surface">
                {promotion.bonusParts.map((part) => (
                  <div key={part.id} className="flex items-center justify-between p-4">
                    <span className="text-sm text-ink-700">{part.label}</span>
                    <span className="font-mono text-sm font-medium">{formatPLN(part.amountCents)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm font-semibold text-ink-900">Premia maksymalna</span>
                  <span className="font-mono text-sm font-semibold">{formatPLN(bonusPartsSum || promotion.maxBonusCents)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Premia maksymalna nie jest gwarantowana — otrzymasz ją tylko po spełnieniu wszystkich warunków
                cząstkowych opisanych poniżej.
              </p>
            </section>
          )}

          {/* Deep-dive guide, if one has been written for this promotion */}
          {relatedArticle && (
            <section className="mt-12 rounded-xl2 border border-teal-100 bg-teal-100/40 p-5">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Dowiedz się więcej o tej promocji</h2>
                  <p className="mt-1 text-sm text-ink-700">{relatedArticle.excerpt}</p>
                  <Link
                    href={`/blog/${relatedArticle.slug}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
                  >
                    Przeczytaj poradnik <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Conditions */}
          {promotion.conditions.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold">Co musisz zrobić?</h2>
              <div className="mt-4">
                <ConditionsChecklist conditions={promotion.conditions} />
              </div>
            </section>
          )}

          {/* Eligibility */}
          {(promotion.eligibleFor || promotion.notEligibleFor) && (
            <section className="mt-12 grid gap-4 sm:grid-cols-2">
              {promotion.eligibleFor && (
                <div className="rounded-xl2 border border-teal-100 bg-teal-100/40 p-4">
                  <p className="text-sm font-semibold text-teal-700">Promocja dla:</p>
                  <p className="mt-1 text-sm text-ink-700">{promotion.eligibleFor}</p>
                </div>
              )}
              {promotion.notEligibleFor && (
                <div className="rounded-xl2 border border-coral-100 bg-coral-100/40 p-4">
                  <p className="text-sm font-semibold text-coral-600">Kto nie może skorzystać?</p>
                  <p className="mt-1 text-sm text-ink-700">{promotion.notEligibleFor}</p>
                </div>
              )}
            </section>
          )}

          {/* Fees */}
          {promotion.fees && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold">Czy konto jest darmowe?</h2>
              <div className="mt-4 divide-y divide-ink-100 rounded-xl2 border border-ink-100 bg-surface">
                {[
                  { label: "Prowadzenie konta", value: promotion.fees.accountFeeCents },
                  { label: "Karta", value: promotion.fees.cardFeeCents }
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between p-4">
                    <span className="text-sm text-ink-700">{row.label}</span>
                    <span className="font-mono text-sm font-medium">{row.value === 0 ? "0 zł" : formatPLN(row.value)}</span>
                  </div>
                ))}
              </div>
              {promotion.fees.otherFee && (
                <p className="mt-2 text-sm text-ink-500">* {promotion.fees.otherFee}</p>
              )}
            </section>
          )}

          {/* Verification / disclosure */}
          <section className="mt-12 rounded-xl2 border border-ink-100 bg-ink-100/40 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />
              <div className="text-sm text-ink-700">
                <p>Ostatnia weryfikacja: {formatDate(promotion.lastVerifiedAt)}</p>
                <p>Promocja ważna do: {formatDate(promotion.endDate)}</p>
                {promotion.sourceUrl && (
                  <p className="mt-1">
                    Źródło:{" "}
                    <a href={promotion.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                      regulamin promocji na stronie banku
                    </a>
                  </p>
                )}
                {promotion.additionalSourceUrls.length > 0 && (
                  <p className="mt-1">
                    Zobacz też:{" "}
                    {promotion.additionalSourceUrls.map((url, i) => (
                      <span key={url}>
                        {i > 0 && ", "}
                        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                          regulamin {i + 2}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
                {promotion.fees?.sourceUrl && (
                  <p className="mt-1">
                    Taryfa opłat i prowizji:{" "}
                    <a href={promotion.fees.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                      pełny dokument na stronie banku
                    </a>
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-500">
                  Warunki promocji mogą się zmienić po stronie banku. Zawsze zweryfikuj aktualny regulamin przed
                  podjęciem decyzji — nie stanowimy porady finansowej ani prawnej.
                </p>
              </div>
            </div>
          </section>

          <PromotionComments promotionSlug={promotion.slug} currentUser={currentUser} />
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
