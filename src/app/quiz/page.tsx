"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { PromotionCard, type PromotionCardData } from "@/components/PromotionCard";
import { PageViewTracker } from "@/components/PageViewTracker";
import { AttributionCapture } from "@/components/AttributionCapture";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EffortPref = "low" | "medium" | "high";

interface Answers {
  effort: EffortPref | null;
  canCardPay: boolean | null;
  canInflow: boolean | null;
  bonusOnly: boolean | null;
  hasBusiness: boolean | null;
}

const PERSONAL_ACCOUNT_TYPES = ["PERSONAL", "SAVINGS", "YOUNG", "JOINT"];

const EFFORT_TO_DIFFICULTY: Record<EffortPref, string[]> = {
  low: ["VERY_EASY", "EASY"],
  medium: ["EASY", "MEDIUM"],
  high: ["MEDIUM", "HARD"]
};

export default function QuizPage() {
  const { data } = useSWR<{ promotions: PromotionCardData[] }>("/api/promotions/active", fetcher);
  const [answers, setAnswers] = useState<Answers>({ effort: null, canCardPay: null, canInflow: null, bonusOnly: null, hasBusiness: null });
  const [submitted, setSubmitted] = useState(false);

  const complete = Object.values(answers).every((v) => v !== null);

  const results = useMemo(() => {
    if (!submitted || !data?.promotions) return [];
    const preferredDifficulties = answers.effort ? EFFORT_TO_DIFFICULTY[answers.effort] : [];

    const eligible = answers.hasBusiness
      ? data.promotions
      : data.promotions.filter((p) => PERSONAL_ACCOUNT_TYPES.includes(p.accountType));

    const scored = eligible.map((p) => {
      let score = Number(p.rating);
      if (preferredDifficulties.includes(p.difficulty)) score += 2;
      if (answers.bonusOnly) score += p.maxBonusCents / 20000;
      return { promotion: p, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [submitted, data, answers]);

  return (
    <div className="container-page max-w-xl py-14">
      <PageViewTracker />
      <AttributionCapture />
      <h1 className="text-3xl font-semibold">Dopasuj promocję do siebie</h1>
      <p className="mt-3 text-ink-500">
        Odpowiedz na kilka pytań — pokażemy Ci 3 promocje najlepiej dopasowane do Twoich preferencji. To nie jest
        indywidualna porada finansowa, a jedynie sortowanie ofert z naszej bazy.
      </p>

      {!submitted ? (
        <form
          className="mt-8 space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <QuizQuestion
            question="Ile pracy chcesz włożyć w promocję?"
            options={[
              { value: "low", label: "Jak najmniej" },
              { value: "medium", label: "Trochę mi to nie przeszkadza" },
              { value: "high", label: "Nie ma znaczenia, zależy mi na wysokiej premii" }
            ]}
            value={answers.effort}
            onChange={(v) => setAnswers((a) => ({ ...a, effort: v as EffortPref }))}
          />
          <QuizYesNo
            question="Czy możesz wykonywać płatności kartą?"
            value={answers.canCardPay}
            onChange={(v) => setAnswers((a) => ({ ...a, canCardPay: v }))}
          />
          <QuizYesNo
            question="Czy możesz zapewnić miesięczny wpływ na konto?"
            value={answers.canInflow}
            onChange={(v) => setAnswers((a) => ({ ...a, canInflow: v }))}
          />
          <QuizYesNo
            question="Czy interesuje Cię wyłącznie najwyższa premia?"
            value={answers.bonusOnly}
            onChange={(v) => setAnswers((a) => ({ ...a, bonusOnly: v }))}
          />
          <QuizYesNo
            question="Czy posiadasz działalność gospodarczą?"
            value={answers.hasBusiness}
            onChange={(v) => setAnswers((a) => ({ ...a, hasBusiness: v }))}
          />

          <button
            type="submit"
            disabled={!complete}
            className="w-full rounded-full bg-ink-solid py-3 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40"
          >
            Pokaż dopasowane promocje
          </button>
        </form>
      ) : (
        <div className="mt-10">
          <h2 className="text-xl font-semibold">Twoje dopasowane promocje</h2>
          {results.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Brak wystarczających danych w bazie, aby wygenerować dopasowanie.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {results.map(({ promotion }, i) => (
                <div key={promotion.slug} className="relative">
                  <span className="absolute -left-3 -top-3 text-xl">{["🥇", "🥈", "🥉"][i]}</span>
                  <PromotionCard promotion={promotion} />
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setSubmitted(false)} className="mt-6 text-sm font-medium text-teal-700 underline">
            Zmień odpowiedzi
          </button>
        </div>
      )}
    </div>
  );
}

function QuizQuestion({
  question,
  options,
  value,
  onChange
}: {
  question: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink-900">{question}</legend>
      <div className="mt-3 space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl2 border p-3 text-sm ${
              value === opt.value ? "border-ink-900 bg-ink-100/50" : "border-ink-100"
            }`}
          >
            <input type="radio" name={question} className="accent-teal-600" checked={value === opt.value} onChange={() => onChange(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function QuizYesNo({
  question,
  value,
  onChange
}: {
  question: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <QuizQuestion
      question={question}
      options={[
        { value: "yes", label: "Tak" },
        { value: "no", label: "Nie" }
      ]}
      value={value === null ? null : value ? "yes" : "no"}
      onChange={(v) => onChange(v === "yes")}
    />
  );
}
