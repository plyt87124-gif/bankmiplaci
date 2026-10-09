import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionCapture } from "@/components/AttributionCapture";
import { EligibilityBanner } from "@/components/EligibilityBanner";
import { FaqAccordion } from "@/components/FaqAccordion";
import { JoinChecklistButton } from "@/components/JoinChecklistButton";
import { JsonLd } from "@/components/JsonLd";
import { PromotionComments } from "@/components/PromotionComments";
import { PromotionImpression } from "@/components/PromotionImpression";
import { BankOffers } from "@/components/promocja/BankOffers";
import { BonusBreakdown, splitBonusParts } from "@/components/promocja/BonusBreakdown";
import { ConditionsSection } from "@/components/promocja/ConditionsSection";
import { EndCta } from "@/components/promocja/EndCta";
import { FeesSection } from "@/components/promocja/FeesSection";
import { ForWhom } from "@/components/promocja/ForWhom";
import { KeyFacts } from "@/components/promocja/KeyFacts";
import { MobileCtaBar } from "@/components/promocja/MobileCtaBar";
import { OfferAside } from "@/components/promocja/OfferAside";
import { OfferHeader } from "@/components/promocja/OfferHeader";
import { OfferNotices } from "@/components/promocja/OfferNotices";
import { RelatedGuide } from "@/components/promocja/RelatedGuide";
import { SourceSection } from "@/components/promocja/SourceSection";
import { buildOfferFaq } from "@/components/promocja/offerFaq";
import {
  bankOffersListHref,
  cooldownRule,
  deriveOfferState,
  methodologyHref,
  normalizeRef,
  pickBankOffers,
  splitLines,
  termFact
} from "@/components/promocja/offerModel";
import { buildOfferStructuredData } from "@/components/promocja/offerStructuredData";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { outboundHref } from "@/lib/affiliate";
import { formatDatePL, formatPLN } from "@/lib/format";
import { deadlineState } from "@/lib/freshness";
import { robotsForStatus } from "@/lib/promotionAvailability";
import {
  absoluteUrl,
  buildMetadata,
  expiredPromotionTitle,
  isRouteLive,
  makeDescription,
  promotionTitle,
  DYNAMIC_ROUTE_FLAGS
} from "@/lib/seo";
import { computeEligibility, isChecklistRestartLocked } from "@/lib/services/eligibility";
import {
  countChecklistSteps,
  getBankHistory,
  getOffer,
  getOffersOfBank,
  getRelatedArticle,
  getTracking,
  getViewer,
  isAdminViewer,
  listIndexableSlugs
} from "./offerData";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string | string[] }>;
}

/**
 * Preparation for WP-17 (session out of the root layout -> ISR): the slugs are
 * known and the page may be re-validated every 10 minutes. TODAY neither has an
 * effect: the root layout and this page read the visitor's session cookie, so
 * Next renders the route per request. User-specific data (cooldown, bank
 * history, ściąga state) stays on the server until WP-17 moves it to the client.
 */
export const revalidate = 600;

export async function generateStaticParams() {
  return (await listIndexableSlugs()).map((slug) => ({ slug }));
}

/** DOM ids shared between the aside's main call to action, the sticky bar and the comments. */
const MAIN_CTA_ID = "glowny-cta";
const COMMENTS_ID = "komentarze";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const promotion = await getOffer(slug);
  // A draft is invisible to everyone but a signed-in admin: do not leak its name into <title>.
  if (!promotion || (promotion.status === "DRAFT" && !(await isAdminViewer()))) {
    return { title: "Promocja nie znaleziona", robots: { index: false, follow: true } };
  }

  const now = new Date();
  const bankName = promotion.bank.name;
  const ended = deriveOfferState(promotion, now).deadlinePassed;
  const title = ended
    ? expiredPromotionTitle({ name: promotion.name, bankName }, promotion.endDate)
    : promotionTitle({
        name: promotion.name,
        bankName,
        accountType: promotion.accountType,
        maxBonusCents: promotion.maxBonusCents
      });

  return buildMetadata({
    title,
    description: makeDescription(promotion.summary, {
      bankName,
      name: promotion.name,
      endDate: promotion.endDate,
      lastVerifiedAt: promotion.lastVerifiedAt,
      now
    }),
    path: `/promocje/${promotion.slug}`,
    // Indexing and sign-up availability are separate decisions (src/lib/promotionAvailability.ts):
    // the same robotsForStatus() decides what sitemap.xml lists - an offer ended
    // up to 90 days ago stays indexed (with the "ended" banner), older ones are noindex.
    robots: robotsForStatus(promotion.status, promotion.endDate, now)
  });
}

export default async function PromotionDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const [promotion, currentUser] = await Promise.all([getOffer(slug), getViewer()]);

  if (!promotion) notFound();
  if (promotion.status === "DRAFT" && !(await isAdminViewer())) notFound();

  const now = new Date();
  const { bank } = promotion;
  const state = deriveOfferState(promotion, now);

  // Everything below depends only on the offer and the visitor - one round of parallel reads.
  const [bankHistory, checklistStepCount, relatedArticle, tracking, bankCards] = await Promise.all([
    currentUser ? getBankHistory(currentUser.id, promotion.bankId, promotion.accountType) : null,
    countChecklistSteps(promotion.id),
    getRelatedArticle(promotion.id),
    currentUser ? getTracking(currentUser.id, promotion.id) : null,
    getOffersOfBank(bank.slug)
  ]);

  const cooldown = cooldownRule(promotion);
  const eligibility = computeEligibility(
    promotion.cooldownMonths,
    promotion.cooldownCutoffDate,
    bankHistory?.wasClientUntil
  );

  // Rewards from a sub-offer whose own sign-up window has closed stay in the
  // data for people who already joined, but are never shown as available.
  const { open: openParts, closed: closedParts } = splitBonusParts(promotion.bonusParts, now);

  const hasEligibilityText =
    splitLines(promotion.eligibleFor).length > 0 || splitLines(promotion.notEligibleFor).length > 0;

  // Links.
  const methodologyLive = isRouteLive("/metodologia");
  const ratingHref = methodologyHref(methodologyLive);
  const verificationHref = methodologyHref(methodologyLive, "weryfikacja");
  const ref = normalizeRef(search.ref);
  const mainCtaHref = outboundHref(
    promotion.slug,
    ref ? { source: "eligibility-email", campaign: ref } : { source: "detail-cta" }
  );
  const endCtaHref = outboundHref(promotion.slug, { source: "detail-cta-bottom" });
  const stickyCtaHref = outboundHref(promotion.slug, { source: "detail-cta-sticky" });

  const bankOffers = pickBankOffers(bankCards, promotion, state.expired);
  const hasBankOffers = bankOffers.length > 0;
  const toBankOffers = state.expired && hasBankOffers;
  const moreOffersHref = toBankOffers ? "#inne-promocje" : "/promocje";
  const moreOffersLabel = state.expired
    ? hasBankOffers
      ? `Aktualne promocje ${bank.name}`
      : "Zobacz aktualne promocje"
    : "Zobacz inne promocje";

  // Text blocks that must agree between the page and its structured data.
  const endDateText = formatDatePL(promotion.endDate, "numeric");
  const faqItems = buildOfferFaq({
    name: promotion.name,
    bankName: bank.name,
    maxBonusCents: promotion.maxBonusCents,
    bonusParts: openParts,
    conditions: promotion.conditions,
    endDate: promotion.endDate,
    ended: state.deadlinePassed,
    cooldown,
    eligibleFor: promotion.eligibleFor,
    fees: promotion.fees,
    lastVerifiedAt: promotion.lastVerifiedAt,
    verificationHref
  });
  const description = makeDescription(promotion.summary, {
    bankName: bank.name,
    name: promotion.name,
    endDate: promotion.endDate,
    lastVerifiedAt: promotion.lastVerifiedAt,
    now
  });
  const structuredData = buildOfferStructuredData({
    promotion: {
      slug: promotion.slug,
      name: promotion.name,
      bankName: bank.name,
      bankWebsite: bank.website,
      bankLogoUrl: bank.logoUrl,
      accountType: promotion.accountType,
      lastVerifiedAt: promotion.lastVerifiedAt,
      endDate: promotion.endDate,
      fees: promotion.fees
        ? {
            accountFeeCents: promotion.fees.accountFeeCents,
            accountFeeWaiverCondition: promotion.fees.accountFeeWaiverCondition,
            cardFeeCents: promotion.fees.cardFeeCents,
            cardFeeWaiverCondition: promotion.fees.cardFeeWaiverCondition,
            otherFee: promotion.fees.otherFee,
            sourceUrl: promotion.fees.sourceUrl
          }
        : null
    },
    description,
    faq: faqItems.map((item) => ({ question: item.question, answer: item.answer }))
  });

  const term = termFact(promotion.endDate, now);
  const deadline = deadlineState(promotion.endDate, now);
  // Sticky bar, second line: "Koniec za 4 dni" when it is close (<= 14 days), else "do 31.10.2026".
  const stickyTermText = deadline.state === "soon" || deadline.state === "urgent" ? deadline.label : term.primary;
  const hasBonus = promotion.maxBonusCents > 0;
  const hasChecklist = checklistStepCount > 0;

  return (
    <div className="container-page py-6 md:py-10">
      <AttributionCapture />
      <PromotionImpression promotionId={promotion.id} />
      <JsonLd data={structuredData} />

      <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Promocje", href: "/promocje" }, { label: promotion.name }]} />

      <OfferNotices
        state={state}
        endDateText={endDateText}
        bankName={bank.name}
        currentOffersHref={moreOffersHref}
        regulationUrl={promotion.sourceUrl}
      />

      <OfferHeader
        name={promotion.name}
        summary={promotion.summary}
        accountType={promotion.accountType}
        bank={{ name: bank.name, logoUrl: bank.logoUrl }}
        lastVerifiedAt={promotion.lastVerifiedAt}
        ended={state.deadlinePassed}
        draft={state.draft}
        now={now}
      />

      <KeyFacts
        maxBonusCents={promotion.maxBonusCents}
        endDate={promotion.endDate}
        difficulty={promotion.difficulty}
        fees={promotion.fees}
        cooldown={cooldown}
        hasEligibilityText={hasEligibilityText}
        now={now}
      />

      {/* Only offers with a cooldown rule can say anything about eligibility, and an ended offer has nothing to join. */}
      {cooldown && !state.expired ? (
        <EligibilityBanner result={eligibility} bankName={bank.name} accountType={promotion.accountType} className="mt-6" />
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start">
        {/* The aside comes first in the DOM so the call to action sits right after the summary on a phone;
            from lg it is the sticky right-hand column. */}
        <OfferAside
          state={state}
          maxBonusCents={promotion.maxBonusCents}
          endDate={promotion.endDate}
          rating={promotion.rating}
          ctaHref={mainCtaHref}
          moreOffersHref={moreOffersHref}
          moreOffersLabel={moreOffersLabel}
          ratingHref={ratingHref}
          showChecklistLink={hasChecklist && !state.expired}
          loggedIn={Boolean(currentUser)}
          mainCtaId={MAIN_CTA_ID}
          now={now}
        />

        <div className="min-w-0 space-y-12 md:space-y-14 lg:col-start-1 lg:row-start-1">
          <ConditionsSection bankName={bank.name} conditions={promotion.conditions} hasChecklist={hasChecklist}>
            {hasChecklist ? (
              <JoinChecklistButton
                promotionId={promotion.id}
                loggedIn={Boolean(currentUser)}
                // Mid-progress (joined, not finished yet) is independent of eligibility - only
                // matters once they've completed the checklist. A completed tracking only stays
                // "locked" while the resulting karencja hasn't cleared yet; if the user is
                // eligible again (cooldown passed, or they corrected their dates in Moje konto),
                // let them start a fresh round instead.
                alreadyJoined={Boolean(tracking) && !tracking?.completedAt}
                locked={isChecklistRestartLocked(tracking?.completedAt, eligibility)}
              />
            ) : null}
          </ConditionsSection>

          <ForWhom
            eligibleFor={promotion.eligibleFor}
            notEligibleFor={promotion.notEligibleFor}
            cooldown={cooldown}
            bankName={bank.name}
          />

          <BonusBreakdown openParts={openParts} closedParts={closedParts} maxBonusCents={promotion.maxBonusCents} />

          <FeesSection fees={promotion.fees} />

          <SourceSection
            slug={promotion.slug}
            lastVerifiedAt={promotion.lastVerifiedAt}
            endDate={promotion.endDate}
            ended={state.deadlinePassed}
            sourceUrl={promotion.sourceUrl}
            additionalSourceUrls={promotion.additionalSourceUrls}
            feesSourceUrl={promotion.fees?.sourceUrl ?? null}
            bankWebsite={bank.website}
            rating={promotion.rating}
            ratingReason={promotion.ratingReason}
            ratingHref={ratingHref}
            verificationHref={verificationHref}
            shareUrl={absoluteUrl(`/promocje/${promotion.slug}`)}
            shareTitle={promotionTitle({
              name: promotion.name,
              bankName: bank.name,
              accountType: promotion.accountType,
              maxBonusCents: promotion.maxBonusCents
            })}
            now={now}
          />

          <section aria-labelledby="faq-h">
            <h2 id="faq-h">Najczęstsze pytania o tę promocję</h2>
            <div className="mt-5">
              <FaqAccordion items={faqItems} />
            </div>
          </section>

          <RelatedGuide article={relatedArticle} />

          <BankOffers
            bankName={bank.name}
            offers={bankOffers}
            ended={state.expired}
            allOffersHref={bankOffersListHref(bank.slug, DYNAMIC_ROUTE_FLAGS.bankPages)}
          />

          <div id={COMMENTS_ID} className="scroll-mt-20">
            <PromotionComments
              promotionSlug={promotion.slug}
              currentUser={currentUser ? { email: currentUser.email, name: currentUser.name } : null}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <EndCta
          state={state}
          bankName={bank.name}
          href={endCtaHref}
          moreOffersHref={moreOffersHref}
          moreOffersLabel={moreOffersLabel}
        />
      </div>

      {state.ctaLive ? (
        <MobileCtaBar
          href={stickyCtaHref}
          amountText={hasBonus ? `do ${formatPLN(promotion.maxBonusCents)}` : "Bez premii gotówkowej"}
          termText={stickyTermText}
          termTone={term.tone}
          mainCtaId={MAIN_CTA_ID}
          endMarkerId={COMMENTS_ID}
        />
      ) : null}
    </div>
  );
}
