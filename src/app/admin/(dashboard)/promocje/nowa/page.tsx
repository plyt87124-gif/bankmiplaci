import { db } from "@/lib/db";
import { PromotionForm } from "../PromotionForm";
import { createPromotion } from "../actions";
import type { PromotionFormValues } from "@/lib/validation/promotion";

export default async function NewPromotionPage() {
  const banks = await db.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  async function handleSubmit(values: PromotionFormValues) {
    "use server";
    await createPromotion(values);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Nowa promocja</h1>
      <p className="mt-1 text-sm text-ink-500">
        Promocja zapisze się jako wersja robocza, chyba że ustawisz status „Aktywna”.
      </p>
      <div className="mt-8">
        <PromotionForm
          banks={banks}
          defaultValues={{}}
          onSubmit={handleSubmit}
          submitLabel="Utwórz promocję"
        />
      </div>
    </div>
  );
}
