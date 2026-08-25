"use client";

import { useState } from "react";
import { Trash2, Pencil, X } from "lucide-react";
import type { BankFormValues } from "@/lib/validation/promotion";

interface BankRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  _count: { promotions: number };
}

interface Props {
  banks: BankRow[];
  createBank: (values: BankFormValues) => Promise<void>;
  updateBank: (id: string, values: BankFormValues) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
}

const emptyForm = { name: "", slug: "", logoUrl: "", website: "", description: "" };

export function BanksManager({ banks, createBank, updateBank, deleteBank }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);

  function startEdit(bank: BankRow) {
    setEditingId(bank.id);
    setForm({
      name: bank.name,
      slug: bank.slug,
      logoUrl: bank.logoUrl ?? "",
      website: bank.website ?? "",
      description: bank.description ?? ""
    });
    setLogoError(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setLogoError(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await updateBank(editingId, form);
      else await createBank(form);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(bank: BankRow) {
    if (bank._count.promotions > 0) return;
    if (!confirm(`Na pewno usunąć bank „${bank.name}”?`)) return;
    await deleteBank(bank.id);
    if (editingId === bank.id) resetForm();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-ink-500">
              <th className="p-3 font-medium">Nazwa</th>
              <th className="p-3 font-medium">Slug</th>
              <th className="p-3 font-medium">Promocje</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {banks.map((bank) => (
              <tr
                key={bank.id}
                className={`border-b border-ink-100 last:border-0 ${editingId === bank.id ? "bg-teal-100/30" : ""}`}
              >
                <td className="flex items-center gap-2 p-3 font-medium text-ink-900">
                  {bank.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bank.logoUrl} alt="" className="h-6 w-6 rounded-full border border-ink-100 bg-white object-contain p-0.5" />
                  )}
                  {bank.name}
                </td>
                <td className="p-3 text-ink-500">{bank.slug}</td>
                <td className="p-3">{bank._count.promotions}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => startEdit(bank)} className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
                      <Pencil className="h-3.5 w-3.5" /> Edytuj
                    </button>
                    <button
                      onClick={() => onDelete(bank)}
                      disabled={bank._count.promotions > 0}
                      title={bank._count.promotions > 0 ? "Usuń najpierw promocje tego banku" : "Usuń bank"}
                      className="text-ink-300 hover:text-coral-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {banks.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-ink-500">
                  Brak banków. Dodaj pierwszy w formularzu obok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="h-fit space-y-3 rounded-xl2 border border-ink-100 bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">{editingId ? "Edytuj bank" : "Dodaj bank"}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="flex items-center gap-1 text-xs text-ink-500 hover:text-coral-600">
              <X className="h-3.5 w-3.5" /> Anuluj
            </button>
          )}
        </div>

        <input
          required
          placeholder="Nazwa banku"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
        />
        <input
          required
          placeholder="slug-banku"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
        />

        <div>
          <div className="flex items-center gap-2">
            <input
              placeholder="URL logo (opcjonalnie)"
              value={form.logoUrl}
              onChange={(e) => {
                setForm((f) => ({ ...f, logoUrl: e.target.value }));
                setLogoError(false);
              }}
              className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            />
            {form.logoUrl && !logoError && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoUrl}
                alt="Podgląd logo"
                onError={() => setLogoError(true)}
                className="h-10 w-10 shrink-0 rounded-full border border-ink-100 bg-white object-contain p-1"
              />
            )}
          </div>
          {logoError && <p className="mt-1 text-xs text-coral-600">Nie udało się wczytać obrazu spod tego adresu.</p>}
        </div>

        <input
          placeholder="Strona banku (opcjonalnie)"
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
        />
        <textarea
          placeholder="Krótki opis (opcjonalnie)"
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
        />

        <button disabled={saving} className="w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
          {saving ? "Zapisywanie..." : editingId ? "Zapisz zmiany" : "Dodaj bank"}
        </button>
      </form>
    </div>
  );
}
