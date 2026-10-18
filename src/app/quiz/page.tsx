import type { Metadata } from "next";
import { AttributionCapture } from "@/components/AttributionCapture";
import { JsonLd } from "@/components/JsonLd";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { pluralizePl } from "@/lib/format";
import { QUIZ_QUESTION_COUNT, QUIZ_RESULT_COUNT } from "@/lib/quiz";
import { breadcrumbLd, staticPageMetadata } from "@/lib/seo";
import { loadQuizOffers } from "./data";
import { QuizClient } from "./QuizClient";

export const metadata: Metadata = staticPageMetadata("quiz");

const CRUMBS = [
  { label: "Start", href: "/" },
  { label: "Quiz" }
];

/**
 * Server component: the offers are read once here (slim public cards plus the
 * condition types, no affiliate URL, no commission) and handed to the client
 * wizard as props - no second request from the browser.
 */
export default async function QuizPage() {
  const offers = await loadQuizOffers();

  return (
    <div className="container-page py-8 md:py-12">
      <AttributionCapture />
      <JsonLd
        data={breadcrumbLd([
          { name: "Start", path: "/" },
          { name: "Quiz", path: "/quiz" }
        ])}
      />
      <div className="container-reading">
        <Breadcrumbs items={CRUMBS} />
        <h1 className="mt-4">Dopasuj promocję do siebie</h1>
        <p className="type-lead mt-4 text-ink-700">
          Odpowiedz na {QUIZ_QUESTION_COUNT} {pluralizePl(QUIZ_QUESTION_COUNT, "pytanie", "pytania", "pytań")}. Pokażemy{" "}
          {QUIZ_RESULT_COUNT} {pluralizePl(QUIZ_RESULT_COUNT, "promocję", "promocje", "promocji")}, które najlepiej pasują
          do Twoich odpowiedzi.
        </p>
        <p className="mt-3 text-small text-ink-500">
          To sortowanie ofert z naszego zestawienia, a nie indywidualna porada finansowa. Odpowiedzi nigdzie nie wysyłamy.
        </p>

        <div className="mt-8">
          <QuizClient offers={offers} />
        </div>

      </div>
    </div>
  );
}
