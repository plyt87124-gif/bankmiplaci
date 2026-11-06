// Waga konkursu w prowizji (a przez nią w ocenie serwisu, „Polecane” i „Razem”): premia za KAŻDE pojedyncze konto
// liczy się w całości, każda inna (za N kont, jednorazowo po N kontach) w 50%, próg powyżej 10 kont i ranking
// nic nie dodają (decyzja właściciela 6.11.2026). Prawdziwe wypłaty (contestBonusCents) zostają bez wag.
import test from "node:test";
import assert from "node:assert/strict";
import { contestBonusCents } from "../src/lib/affiliateNetworks";
import {
  CONTEST_REFERENCE_CLIENTS,
  MULTI_ACCOUNT_CONTEST_WEIGHT,
  contestPerClientCents,
  effectiveCommissionCents,
  type CommissionContest,
  type CommissionOffer
} from "../src/lib/effectiveCommission";

const per = (tiers: unknown) => contestPerClientCents([{ tiers }]);

test("konkurs za każde jedno konto liczy się w całości, jak wyższa prowizja", () => {
  assert.equal(CONTEST_REFERENCE_CLIENTS, 10);
  assert.equal(per([{ everyN: 1, bonusCents: 22_000 }]), 22_000);
});

test("konkursy na wielokrotność kont liczą się w połowie wartości na klienta", () => {
  assert.equal(MULTI_ACCOUNT_CONTEST_WEIGHT, 0.5);
  assert.equal(per([{ everyN: 3, bonusCents: 15_000 }]), 2_250, "150 zł za każde 3 konta: 45 zł na klienta, w połowie 22,50 zł");
  assert.equal(per([{ everyN: 5, bonusCents: 50_000 }]), 5_000);
  assert.equal(per([{ atLeast: 5, bonusCents: 60_000 }]), 3_000, "600 zł jednorazowo po 5 kontach: 60 zł na klienta, w połowie 30 zł");
  assert.equal(per([{ atLeast: 10, bonusCents: 100_000 }]), 5_000);
});

test("próg powyżej 10 kont i ranking na razie nic nie dodają", () => {
  assert.equal(per([{ atLeast: 30, bonusCents: 500_000 }]), 0);
  assert.equal(per([]), 0, "ranking miejsc, bez progów");
  assert.equal(per("nie-lista"), 0);
});

test("konkurs z kilkoma progami: pojedyncze konto w całości, reszta w połowie, sumy się dodają", () => {
  assert.equal(
    per([
      { everyN: 1, bonusCents: 10_000 },
      { atLeast: 5, bonusCents: 60_000 }
    ]),
    10_000 + 3_000
  );
  assert.equal(contestPerClientCents([{ tiers: [{ everyN: 1, bonusCents: 22_000 }] }, { tiers: [{ everyN: 3, bonusCents: 15_000 }] }]), 22_000 + 2_250);
});

test("PKO: 80 zł stawki + 220 zł za każde konto = 300 zł; dodatkowy konkurs wielokontowy dokłada połowę", () => {
  const offer: CommissionOffer = { network: "EBROKER", externalId: "1", cpsCents: 8_000, cpaCents: 0 };
  const single: CommissionContest = { network: "EBROKER", offerExternalIds: ["1"], tiers: [{ everyN: 1, bonusCents: 22_000 }] };
  const multi: CommissionContest = { network: "EBROKER", offerExternalIds: ["1"], tiers: [{ everyN: 3, bonusCents: 15_000 }] };
  assert.equal(effectiveCommissionCents([offer], [single]), 30_000);
  assert.equal(effectiveCommissionCents([offer], [single, multi]), 30_000 + 2_250);
  assert.equal(effectiveCommissionCents([offer], [multi]), 8_000 + 2_250);
});

test("prawdziwe wypłaty (admin, raport) liczą pełne kwoty bez wag", () => {
  assert.equal(contestBonusCents([{ everyN: 3, bonusCents: 15_000 }], 10), 45_000);
  assert.equal(contestBonusCents([{ atLeast: 5, bonusCents: 60_000 }], 10), 60_000);
});
