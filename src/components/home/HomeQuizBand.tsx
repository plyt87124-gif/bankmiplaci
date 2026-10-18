import { ButtonLink } from "@/components/ui/Button";
import { pluralizePl } from "@/lib/format";
import { QUIZ_QUESTION_COUNT, QUIZ_RESULT_COUNT } from "@/lib/quiz";

/**
 * The quiz as a horizontal band between hairlines (layout spec, HOME block 5),
 * not a card in the hero. The numbers come from the quiz's own constants
 * (number of questions, number of offers in the result), so the copy cannot
 * drift from what the quiz does; the sentence is the one the /quiz page uses.
 */
export function HomeQuizBand() {
  return (
    <section aria-labelledby="quiz-title" className="border-y border-line bg-surface">
      <div className="container-page flex flex-col gap-5 py-8 md:flex-row md:items-center md:justify-between md:gap-10 md:py-10">
        <div className="max-w-2xl">
          <h2 id="quiz-title" className="font-body text-h3 md:text-h3">
            Nie wiesz, którą promocję wybrać?
          </h2>
          <p className="mt-2 text-article text-ink-700">
            Odpowiedz na {QUIZ_QUESTION_COUNT} {pluralizePl(QUIZ_QUESTION_COUNT, "pytanie", "pytania", "pytań")}.
            Pokażemy {QUIZ_RESULT_COUNT} {pluralizePl(QUIZ_RESULT_COUNT, "promocję", "promocje", "promocji")}, które
            najlepiej pasują do Twoich odpowiedzi.
          </p>
        </div>
        <ButtonLink href="/quiz" variant="secondary" className="shrink-0 self-start md:self-auto">
          Dopasuj w quizie
        </ButtonLink>
      </div>
    </section>
  );
}
