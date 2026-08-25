import { db } from "@/lib/db";
import { createBank, updateBank, deleteBank } from "./actions";
import { BanksManager } from "./BanksManager";

export default async function AdminBanksPage() {
  const banks = await db.bank.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { promotions: true } } } });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Banki</h1>
      <div className="mt-6">
        <BanksManager banks={banks} createBank={createBank} updateBank={updateBank} deleteBank={deleteBank} />
      </div>
    </div>
  );
}
