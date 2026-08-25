"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { promotionFormSchema, type PromotionFormValues } from "@/lib/validation/promotion";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Bank {
  id: string;
  name: string;
}

export function PromotionForm({
  banks,
  defaultValues,
  onSubmit,
  submitLabel
}: {
  banks: Bank[];
  defaultValues: Partial<PromotionFormValues>;
  onSubmit: (values: PromotionFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting }
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      status: "DRAFT",
      accountType: "PERSONAL",
      difficulty: "EASY",
      conditions: [],
      bonusParts: [],
      fees: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 },
      ...defaultValues
    } as PromotionFormValues
  });

  const conditions = useFieldArray({ control, name: "conditions" });
  const bonusParts = useFieldArray({ control, name: "bonusParts" });

  async function submit(values: PromotionFormValues) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Wystąpił nieoczekiwany błąd.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="max-w-3xl space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Podstawowe informacje</h2>
        <Field label="Bank" error={errors.bankId?.message}>
          <select {...register("bankId")} className="input">
            <option value="">Wybierz bank</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nazwa promocji" error={errors.name?.message}>
          <input {...register("name")} className="input" placeholder="np. Konto Otwarte z premią 700 zł" />
        </Field>
        <Field label="Slug (adres URL)" error={errors.slug?.message}>
          <input {...register("slug")} className="input" placeholder="bank-x-700-zl" />
        </Field>
        <Field label="Krótki opis (widoczny w wyszukiwarce i na karcie)" error={errors.summary?.message}>
          <textarea {...register("summary")} className="input" rows={2} />
        </Field>
        <Field label="Typ konta" error={errors.accountType?.message}>
          <select {...register("accountType")} className="input">
            <option value="PERSONAL">Konto osobiste</option>
            <option value="SAVINGS">Konto oszczędnościowe</option>
            <option value="YOUNG">Konto dla młodych</option>
            <option value="BUSINESS">Konto firmowe</option>
            <option value="JOINT">Konto wspólne</option>
          </select>
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Premia, trudność, ocena</h2>
        <Field label="Maksymalna premia (w groszach, np. 70000 = 700 zł)" error={errors.maxBonusCents?.message}>
          <input type="number" {...register("maxBonusCents", { valueAsNumber: true })} className="input" />
        </Field>
        <Field label="Poziom trudności" error={errors.difficulty?.message}>
          <select {...register("difficulty")} className="input">
            <option value="VERY_EASY">Bardzo łatwa</option>
            <option value="EASY">Łatwa</option>
            <option value="MEDIUM">Średnia</option>
            <option value="HARD">Trudna</option>
          </select>
        </Field>
        <Field label="Ocena serwisu (0–10)" error={errors.rating?.message}>
          <input type="number" step="0.1" {...register("rating", { valueAsNumber: true })} className="input" />
        </Field>
        <Field label="Uzasadnienie oceny" error={errors.ratingReason?.message}>
          <input {...register("ratingReason")} className="input" placeholder="Wysoka premia i niewiele wymaganych czynności." />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Terminy i status</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data rozpoczęcia" error={errors.startDate?.message}>
            <input type="date" {...register("startDate")} className="input" />
          </Field>
          <Field label="Data zakończenia" error={errors.endDate?.message}>
            <input type="date" {...register("endDate")} className="input" />
          </Field>
        </div>
        <Field label="Ostatnia weryfikacja" error={errors.lastVerifiedAt?.message}>
          <input type="date" {...register("lastVerifiedAt")} className="input" />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <select {...register("status")} className="input">
            <option value="DRAFT">Wersja robocza (niewidoczna publicznie)</option>
            <option value="ACTIVE">Aktywna</option>
            <option value="EXPIRED">Wygasła</option>
            <option value="ARCHIVED">Zarchiwizowana</option>
          </select>
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Link afiliacyjny i źródło</h2>
        <Field label="Link afiliacyjny (affiliate_url)" error={errors.affiliateUrl?.message}>
          <input {...register("affiliateUrl")} className="input" placeholder="https://partner.example.com/..." />
        </Field>
        <Field label="Źródło warunków (URL regulaminu banku)" error={errors.sourceUrl?.message}>
          <input {...register("sourceUrl")} className="input" placeholder="https://bank.example.com/regulamin" />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Dla kogo jest promocja?</h2>
        <Field label="Promocja dla" error={errors.eligibleFor?.message}>
          <textarea {...register("eligibleFor")} className="input" rows={2} placeholder="nowi klienci banku" />
        </Field>
        <Field label="Kto nie może skorzystać" error={errors.notEligibleFor?.message}>
          <textarea {...register("notEligibleFor")} className="input" rows={2} />
        </Field>
        <Field
          label="Okres karencji w miesiącach (opcjonalnie)"
          error={errors.cooldownMonths?.message}
        >
          <input
            type="number"
            {...register("cooldownMonths", { valueAsNumber: true })}
            className="input"
            placeholder="np. 36 (dla 'nie posiadał konta w ciągu ostatnich 3 lat')"
          />
        </Field>
        <Field
          label="LUB sztywna data graniczna (opcjonalnie)"
          error={errors.cooldownCutoffDate?.message}
        >
          <input type="date" {...register("cooldownCutoffDate")} className="input" />
        </Field>
        <p className="text-xs text-ink-500">
          Wypełnij liczbę miesięcy, jeśli regulamin mówi „N miesięcy/lat od zamknięcia konta”. Wypełnij datę
          graniczną, jeśli regulamin mówi „od DD.MM.RRRR nie prowadziliśmy dla Ciebie konta” (jak np. w Erste).
          Możesz wypełnić oba naraz — użytkownik musi wtedy spełnić obie reguły, żeby zobaczyć „kwalifikujesz
          się”. Zostaw puste, jeśli zasada jest bardziej złożona — opisz ją wtedy tylko w polach tekstowych
          powyżej.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Warunki promocji</h2>
          <button
            type="button"
            onClick={() => conditions.append({ title: "", type: "other", order: conditions.fields.length })}
            className="flex items-center gap-1 text-sm font-medium text-teal-700"
          >
            <Plus className="h-4 w-4" /> Dodaj warunek
          </button>
        </div>
        {conditions.fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-3 rounded-xl2 border border-ink-100 p-4">
            <div className="flex-1 space-y-2">
              <input {...register(`conditions.${index}.title`)} className="input" placeholder="Tytuł warunku" />
              <textarea {...register(`conditions.${index}.description`)} className="input" rows={2} placeholder="Opis (opcjonalnie)" />
              <select {...register(`conditions.${index}.type`)} className="input">
                <option value="account_opening">Otwarcie konta</option>
                <option value="card_payments">Płatności kartą</option>
                <option value="inflow">Wpływ na konto</option>
                <option value="deadline">Termin</option>
                <option value="other">Inne</option>
              </select>
            </div>
            <button type="button" onClick={() => conditions.remove(index)} className="p-2 text-ink-300 hover:text-coral-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rozbicie premii (opcjonalnie)</h2>
          <button
            type="button"
            onClick={() => bonusParts.append({ label: "", amountCents: 0, order: bonusParts.fields.length })}
            className="flex items-center gap-1 text-sm font-medium text-teal-700"
          >
            <Plus className="h-4 w-4" /> Dodaj część premii
          </button>
        </div>
        {bonusParts.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-3 rounded-xl2 border border-ink-100 p-4">
            <input {...register(`bonusParts.${index}.label`)} className="input" placeholder="np. Premia za wpływ" />
            <input
              type="number"
              {...register(`bonusParts.${index}.amountCents`, { valueAsNumber: true })}
              className="input w-40"
              placeholder="Kwota w groszach"
            />
            <button type="button" onClick={() => bonusParts.remove(index)} className="p-2 text-ink-300 hover:text-coral-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Opłaty</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Prowadzenie konta (grosze)">
            <input type="number" {...register("fees.accountFeeCents", { valueAsNumber: true })} className="input" />
          </Field>
          <Field label="Karta (grosze)">
            <input type="number" {...register("fees.cardFeeCents", { valueAsNumber: true })} className="input" />
          </Field>
          <Field label="Bankomat (grosze)">
            <input type="number" {...register("fees.atmFeeCents", { valueAsNumber: true })} className="input" />
          </Field>
        </div>
        <Field label="Inne opłaty / warunki zwolnienia z opłat">
          <textarea {...register("fees.otherFee")} className="input" rows={2} placeholder="0 zł przy wpływie min. 500 zł/mies." />
        </Field>
      </section>

      {serverError && <p className="text-sm text-coral-600">{serverError}</p>}

      <button
        disabled={isSubmitting}
        className="rounded-full bg-ink-solid px-6 py-3 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {isSubmitting ? "Zapisywanie..." : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block text-xs text-coral-600">{error}</span>}
    </label>
  );
}
