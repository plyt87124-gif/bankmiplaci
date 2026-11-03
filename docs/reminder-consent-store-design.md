# Trwały magazyn zgód i rejestru wysyłek przypomnień — projekt (bez wdrożenia)

TASK_KEY: `bmp-reminder-consent-store-design-v1-20261004`
Status dokumentu: **projekt**. Brak migracji, zmian `schema.prisma`, kodu, UI, endpointu, schedulera i wysyłki. Wszystkie testy opisane niżej mają wynik **NOT_RUN** — napisany plan nie jest PASS.

## 0. Podstawa przeglądu i granice

Przeczytane w repozytorium: `prisma/schema.prisma`, `src/lib/services/checklistReminders.ts`, `src/lib/email.ts`, `package.json`. Jako dane referencyjne (pełne źródła z issue, nie z dysku): `src/lib/checklistReminderState.ts`, `src/lib/checklistReminderDispatch.ts`, `docs/checklist-reminder-dispatch-work.md`.

Nieprzeczytane i niezrekonstruowane (do potwierdzenia przez Codex przed implementacją): `checklistTaskReminders.ts` (pola `TaskReminderInput`, skład task key), `emailTemplates.ts`, file store pilota, istniejące `tests/db/*`, kod auth kont publicznych, ewentualna ścieżka usuwania konta. Tam, gdzie projekt od nich zależy, jest to oznaczone jako **[DO WERYFIKACJI]**.

Fakty ze schematu istotne dla projektu:

- `User` nie ma pola zgody ani flagi weryfikacji adresu e‑mail.
- `UserPromotionTracking.remindedGroupIndexes` to deduplikacja starego miesięcznego sendera, nie zgoda.
- `ChecklistProgress` to samodzielnie zgłoszone odhaczenie kroku (`checkedAt`), nie dowód płatności, wpływu ani wypłaty premii.
- Wszystkie relacje do `User` mają `onDelete: Cascade`; daty są `timestamp(3)` bez strefy (domyślne Prisma).
- `sendEmail` połyka wyjątki i nie zwraca dowodu przyjęcia. Stary `sendChecklistDeadlineReminders` wysyła **przed** zapisem `remindedGroupIndexes`, bez zgody i bez rejestru prób. Tego projektu nie zmieniamy; nowy rejestr nie korzysta z `sendEmail`.

Zakres wykluczony: scheduler/cron (archiwalne #80/#124 nie są specyfikacją tego etapu i nie są tu powtarzane), adapter transportu Resend, panel zgód, migracja danych produkcyjnych.

---

## 1. Model danych

### 1.1 Decyzje

1. **Zgoda jest osobnym bytem.** Zakres zgody to: użytkownik + cel (`CHECKLIST_TASK_REMINDER`) + edycja (`editionKey`). Brak wiersza oznacza brak zgody. Nie ma statusu „NONE” ani wiersza domyślnego.
2. `editionKey` to nieprzezroczysty identyfikator edycji z rejestru definicji planera (np. definicja exact mBanku). **Nie** jest to id oferty afiliacyjnej (`13870` nie jest editionId) ani `Promotion.id`. Mapowanie tracking → edycja pochodzi wyłącznie z rejestru definicji planera. Nieznane mapowanie oznacza blokadę.
3. **Zgoda wymaga dowodu decyzji.** Wiersz stanu musi mieć zdarzenie z tą samą wersją, decyzją `GRANT`, źródłem `ACCOUNT_SETTINGS_FORM` i znanym `noticeVersion` (wersją treści pokazanej użytkownikowi). Sam znacznik czasu, puste źródło albo status bez zdarzenia **nie** potwierdzają zgody.
4. **Bez backfillu.** Istniejące trackingi, odhaczenia, `remindedGroupIndexes`, kliknięcia i rejestracje nie tworzą wierszy zgody. Wdrożenie startuje z zerem zgód.
5. **Rejestr wysyłek (ledger) jest niezależny od trackingu.** Klucz główny to `keyHash`. Jedyną referencją routingu jest `consentId`. Uzasadnienie: (a) blokada zgody w tej samej transakcji co claim/begin, (b) wycofanie zgody anuluje oczekujące wiersze, (c) wymazanie użytkownika odnajduje jego wiersze bez przechowywania `userId`. Ledger nie przechowuje adresu, treści, HTML, tematu, sekretu, surowego task key ani surowego receipt.
6. Nowe tabele używają `timestamptz(3)`, mimo że reszta schematu ma `timestamp(3)`. To świadome odstępstwo: porównania z `now()`/`clock_timestamp()` nie zależą wtedy od `TimeZone` sesji, a precyzja 3 zachowuje `toISOString()` 1:1 z walidatorem (`dateOk`).
7. Nazwy kolumn camelCase i `@@map` na tabelach — zgodnie z konwencją projektu. DDL używa cytowanych identyfikatorów.

### 1.2 Proponowane modele Prisma (kandydat, NIE wpisywać teraz do schema)

```prisma
enum ReminderConsentPurpose {
  CHECKLIST_TASK_REMINDER
}

enum ReminderConsentStatus {
  GRANTED
  WITHDRAWN
  ERASED
}

enum ReminderConsentSource {
  ACCOUNT_SETTINGS_FORM
  ERASURE_PROCEDURE
}

enum ReminderConsentDecision {
  GRANT
  WITHDRAW
  ERASE
}

// Values intentionally match ReminderState strings in checklistReminderState.ts.
enum ReminderDeliveryState {
  pending
  reserved
  sending
  retry
  sent
  unknown
  cancelled
  exhausted
}

enum ReminderResolutionDecision {
  PROVIDER_CONFIRMED_ACCEPTED
  PROVIDER_CONFIRMED_NOT_ACCEPTED
}

// Current consent state for one user + purpose + edition. No row = no consent.
// userId is Restrict (not Cascade): deleting a user must go through the
// erasure procedure first, so delivery tombstones are never cascaded away.
model ReminderConsent {
  id            String                 @id @default(cuid())
  userId        String?
  user          User?                  @relation(fields: [userId], references: [id], onDelete: Restrict)
  purpose       ReminderConsentPurpose
  editionKey    String
  status        ReminderConsentStatus
  version       Int
  decidedAt     DateTime               @db.Timestamptz(3)
  source        ReminderConsentSource
  noticeVersion String?
  createdAt     DateTime               @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime               @default(now()) @db.Timestamptz(3)

  events     ReminderConsentEvent[]
  deliveries ReminderDelivery[]

  @@unique([userId, purpose, editionKey])
  @@map("reminder_consents")
}

// Append-only evidence of each explicit decision. No IP, user agent or email.
model ReminderConsentEvent {
  id            BigInt                  @id @default(autoincrement())
  consentId     String
  consent       ReminderConsent         @relation(fields: [consentId], references: [id], onDelete: Restrict)
  version       Int
  decision      ReminderConsentDecision
  source        ReminderConsentSource
  noticeVersion String?
  requestIdHash String                  @db.Char(64)
  decidedAt     DateTime                @default(now()) @db.Timestamptz(3)

  @@unique([consentId, version])
  @@unique([consentId, requestIdHash])
  @@map("reminder_consent_events")
}

// One row per reminder key. Rows are tombstones: never deleted by app code.
model ReminderDelivery {
  keyHash             String                @id @db.Char(64)
  payloadHash         String                @db.Char(64)
  consentId           String
  consent             ReminderConsent       @relation(fields: [consentId], references: [id], onDelete: Restrict)
  state               ReminderDeliveryState @default(pending)
  attempt             Int                   @default(0) @db.SmallInt
  token               String?               @db.Uuid
  leaseUntil          DateTime?             @db.Timestamptz(3)
  nextAttemptAt       DateTime?             @db.Timestamptz(3)
  acceptedAt          DateTime?             @db.Timestamptz(3)
  receiptHash         String?               @db.Char(64)
  claimConsentVersion Int?
  revision            BigInt                @default(0)
  createdAt           DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt           DateTime              @default(now()) @db.Timestamptz(3)

  resolutions ReminderDeliveryResolution[]

  @@index([consentId, state])
  @@map("reminder_deliveries")
}

// Authorized, idempotent decision that moves a row out of `unknown`.
model ReminderDeliveryResolution {
  id              BigInt                     @id @default(autoincrement())
  keyHash         String                     @db.Char(64)
  delivery        ReminderDelivery           @relation(fields: [keyHash], references: [keyHash], onDelete: Restrict)
  fromRevision    BigInt
  appliedRevision BigInt
  decision        ReminderResolutionDecision
  evidenceRefHash String                     @db.Char(64)
  receiptHash     String?                    @db.Char(64)
  actorAdminId    String
  actor           AdminUser                  @relation(fields: [actorAdminId], references: [id], onDelete: Restrict)
  requestIdHash   String                     @unique @db.Char(64)
  decidedAt       DateTime                   @default(now()) @db.Timestamptz(3)

  @@unique([keyHash, appliedRevision])
  @@map("reminder_delivery_resolutions")
}
```

Wymagane relacje zwrotne: `User.reminderConsents ReminderConsent[]` oraz `AdminUser.reminderResolutions ReminderDeliveryResolution[]`.

Prisma 5 nie wyraża w schemacie CHECK, indeksów częściowych ani triggerów. Dodaje je surowy SQL w tej samej migracji (sekcja 1.3). Bramka: `prisma migrate diff` na odizolowanej bazie musi pokazać zero dryfu, w szczególności dla indeksów częściowych. **[DO WERYFIKACJI]**.

### 1.3 PostgreSQL DDL (kandydat)

```sql
CREATE TYPE "ReminderConsentPurpose" AS ENUM ('CHECKLIST_TASK_REMINDER');
CREATE TYPE "ReminderConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN', 'ERASED');
CREATE TYPE "ReminderConsentSource" AS ENUM ('ACCOUNT_SETTINGS_FORM', 'ERASURE_PROCEDURE');
CREATE TYPE "ReminderConsentDecision" AS ENUM ('GRANT', 'WITHDRAW', 'ERASE');
CREATE TYPE "ReminderDeliveryState" AS ENUM
  ('pending', 'reserved', 'sending', 'retry', 'sent', 'unknown', 'cancelled', 'exhausted');
CREATE TYPE "ReminderResolutionDecision" AS ENUM
  ('PROVIDER_CONFIRMED_ACCEPTED', 'PROVIDER_CONFIRMED_NOT_ACCEPTED');

CREATE TABLE "reminder_consents" (
  "id"            text PRIMARY KEY,
  "userId"        text NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "purpose"       "ReminderConsentPurpose" NOT NULL,
  "editionKey"    text NOT NULL,
  "status"        "ReminderConsentStatus" NOT NULL,
  "version"       integer NOT NULL,
  "decidedAt"     timestamptz(3) NOT NULL,
  "source"        "ReminderConsentSource" NOT NULL,
  "noticeVersion" text NULL,
  "createdAt"     timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "rc_edition_key_chk" CHECK ("editionKey" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "rc_version_chk"     CHECK ("version" >= 1),
  CONSTRAINT "rc_notice_fmt_chk"  CHECK ("noticeVersion" IS NULL OR "noticeVersion" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "rc_granted_chk"     CHECK ("status" <> 'GRANTED'
                                         OR ("userId" IS NOT NULL AND "source" = 'ACCOUNT_SETTINGS_FORM' AND "noticeVersion" IS NOT NULL)),
  CONSTRAINT "rc_erased_chk"      CHECK (("status" = 'ERASED') = ("userId" IS NULL)),
  CONSTRAINT "rc_erased_src_chk"  CHECK ("status" <> 'ERASED' OR "source" = 'ERASURE_PROCEDURE')
);
-- NULL userId rows (ERASED) are distinct under a plain unique index.
CREATE UNIQUE INDEX "reminder_consents_userId_purpose_editionKey_key"
  ON "reminder_consents" ("userId", "purpose", "editionKey");

CREATE TABLE "reminder_consent_events" (
  "id"            bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "consentId"     text NOT NULL REFERENCES "reminder_consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version"       integer NOT NULL CHECK ("version" >= 1),
  "decision"      "ReminderConsentDecision" NOT NULL,
  "source"        "ReminderConsentSource" NOT NULL,
  "noticeVersion" text NULL,
  "requestIdHash" char(64) NOT NULL CHECK ("requestIdHash" ~ '^[a-f0-9]{64}$'),
  "decidedAt"     timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "rce_grant_chk" CHECK ("decision" <> 'GRANT'
                                    OR ("source" = 'ACCOUNT_SETTINGS_FORM' AND "noticeVersion" IS NOT NULL)),
  CONSTRAINT "rce_erase_chk" CHECK (("decision" = 'ERASE') = ("source" = 'ERASURE_PROCEDURE'))
);
CREATE UNIQUE INDEX "reminder_consent_events_consentId_version_key"       ON "reminder_consent_events" ("consentId", "version");
CREATE UNIQUE INDEX "reminder_consent_events_consentId_requestIdHash_key" ON "reminder_consent_events" ("consentId", "requestIdHash");

CREATE TABLE "reminder_deliveries" (
  "keyHash"             char(64) PRIMARY KEY CHECK ("keyHash" ~ '^[a-f0-9]{64}$'),
  "payloadHash"         char(64) NOT NULL CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
  "consentId"           text NOT NULL REFERENCES "reminder_consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "state"               "ReminderDeliveryState" NOT NULL DEFAULT 'pending',
  "attempt"             smallint NOT NULL DEFAULT 0 CHECK ("attempt" BETWEEN 0 AND 3),
  "token"               uuid NULL,
  "leaseUntil"          timestamptz(3) NULL,
  "nextAttemptAt"       timestamptz(3) NULL,
  "acceptedAt"          timestamptz(3) NULL,
  "receiptHash"         char(64) NULL CHECK ("receiptHash" IS NULL OR "receiptHash" ~ '^[a-f0-9]{64}$'),
  "claimConsentVersion" integer NULL CHECK ("claimConsentVersion" IS NULL OR "claimConsentVersion" >= 1),
  "revision"            bigint NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "createdAt"           timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"           timestamptz(3) NOT NULL DEFAULT now(),
  -- 1:1 with validateReminderLedger (see section 4.3)
  CONSTRAINT "rd_active_lease_chk"   CHECK (("state" IN ('reserved', 'sending')) = ("leaseUntil" IS NOT NULL)),
  CONSTRAINT "rd_active_token_chk"   CHECK ("state" NOT IN ('reserved', 'sending')
                                            OR ("token" IS NOT NULL AND "attempt" > 0 AND "claimConsentVersion" IS NOT NULL)),
  CONSTRAINT "rd_retry_date_chk"     CHECK (("state" = 'retry') = ("nextAttemptAt" IS NOT NULL)),
  CONSTRAINT "rd_sent_evidence_chk"  CHECK (("state" = 'sent') = ("acceptedAt" IS NOT NULL AND "receiptHash" IS NOT NULL)),
  CONSTRAINT "rd_no_stray_evidence"  CHECK ("state" = 'sent' OR ("acceptedAt" IS NULL AND "receiptHash" IS NULL)),
  CONSTRAINT "rd_pending_chk"        CHECK ("state" <> 'pending' OR ("attempt" = 0 AND "token" IS NULL)),
  CONSTRAINT "rd_attempted_chk"      CHECK ("state" NOT IN ('retry', 'sent', 'unknown', 'exhausted')
                                            OR ("attempt" > 0 AND "token" IS NOT NULL))
);
CREATE INDEX "reminder_deliveries_consentId_state_idx" ON "reminder_deliveries" ("consentId", "state");
CREATE INDEX "reminder_deliveries_active_lease_idx"    ON "reminder_deliveries" ("leaseUntil")
  WHERE "state" IN ('reserved', 'sending');
CREATE INDEX "reminder_deliveries_retry_due_idx"       ON "reminder_deliveries" ("nextAttemptAt")
  WHERE "state" = 'retry';

CREATE TABLE "reminder_delivery_resolutions" (
  "id"              bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "keyHash"         char(64) NOT NULL REFERENCES "reminder_deliveries"("keyHash") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fromRevision"    bigint NOT NULL,
  "appliedRevision" bigint NOT NULL,
  "decision"        "ReminderResolutionDecision" NOT NULL,
  "evidenceRefHash" char(64) NOT NULL CHECK ("evidenceRefHash" ~ '^[a-f0-9]{64}$'),
  "receiptHash"     char(64) NULL CHECK ("receiptHash" IS NULL OR "receiptHash" ~ '^[a-f0-9]{64}$'),
  "actorAdminId"    text NOT NULL REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestIdHash"   char(64) NOT NULL CHECK ("requestIdHash" ~ '^[a-f0-9]{64}$'),
  "decidedAt"       timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "rdr_revision_chk" CHECK ("appliedRevision" = "fromRevision" + 1),
  CONSTRAINT "rdr_accept_chk"   CHECK (("decision" = 'PROVIDER_CONFIRMED_ACCEPTED') = ("receiptHash" IS NOT NULL))
);
CREATE UNIQUE INDEX "reminder_delivery_resolutions_requestIdHash_key"          ON "reminder_delivery_resolutions" ("requestIdHash");
CREATE UNIQUE INDEX "reminder_delivery_resolutions_keyHash_appliedRevision_key" ON "reminder_delivery_resolutions" ("keyHash", "appliedRevision");
```

Triggery strażnicze (obrona w głębi; adapter i tak waliduje):

```sql
CREATE FUNCTION "reminder_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'P0001';
END $$;
CREATE TRIGGER "reminder_consent_events_append_only" BEFORE UPDATE OR DELETE ON "reminder_consent_events"
  FOR EACH ROW EXECUTE FUNCTION "reminder_append_only"();
CREATE TRIGGER "reminder_delivery_resolutions_append_only" BEFORE UPDATE OR DELETE ON "reminder_delivery_resolutions"
  FOR EACH ROW EXECUTE FUNCTION "reminder_append_only"();

CREATE FUNCTION "reminder_deliveries_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'reminder delivery rows are tombstones' USING ERRCODE = 'P0001';
  END IF;
  IF NEW."keyHash" <> OLD."keyHash" OR NEW."payloadHash" <> OLD."payloadHash"
     OR NEW."consentId" <> OLD."consentId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'immutable reminder delivery column' USING ERRCODE = 'P0001';
  END IF;
  IF NEW."revision" <> OLD."revision" + 1 THEN
    RAISE EXCEPTION 'reminder revision must advance by one' USING ERRCODE = 'P0001';
  END IF;
  IF OLD."state" IN ('sent', 'cancelled', 'exhausted') THEN
    RAISE EXCEPTION 'terminal reminder state' USING ERRCODE = 'P0001';
  END IF;
  IF NOT ((OLD."state", NEW."state") IN (
      ('pending','reserved'), ('pending','cancelled'),
      ('retry','reserved'), ('retry','cancelled'), ('retry','exhausted'),
      ('reserved','reserved'), ('reserved','pending'), ('reserved','retry'),
      ('reserved','sending'), ('reserved','cancelled'),
      ('sending','sent'), ('sending','unknown'), ('sending','retry'), ('sending','exhausted'),
      ('unknown','sent'), ('unknown','retry'), ('unknown','exhausted'))) THEN
    RAISE EXCEPTION 'illegal reminder transition % -> %', OLD."state", NEW."state" USING ERRCODE = 'P0001';
  END IF;
  IF OLD."state" = 'reserved' AND NEW."state" = 'reserved' AND NEW."token" IS NOT DISTINCT FROM OLD."token" THEN
    RAISE EXCEPTION 'reclaim requires a new token' USING ERRCODE = 'P0001';
  END IF;
  IF OLD."state" = 'unknown' AND NOT EXISTS (
      SELECT 1 FROM "reminder_delivery_resolutions" r
       WHERE r."keyHash" = NEW."keyHash" AND r."appliedRevision" = NEW."revision") THEN
    RAISE EXCEPTION 'unknown requires an authorized resolution row' USING ERRCODE = 'P0001';
  END IF;
  NEW."updatedAt" := clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER "reminder_deliveries_guard" BEFORE UPDATE OR DELETE ON "reminder_deliveries"
  FOR EACH ROW EXECUTE FUNCTION "reminder_deliveries_guard"();
```

Lista przejść wynika z pełnego kodu, a nie z podsumowania:

- `claim` wywołuje `expire` przed decyzją. Stąd w jednym wywołaniu możliwe są: `reserved→reserved` z nowym tokenem (wygasła rezerwacja zwolniona i od razu przejęta), `reserved→pending/retry` (wygasła rezerwacja i `!allowed`) oraz `reserved→cancelled`.
- `retry→exhausted` pochodzi z obronnej gałęzi `attempt >= 3` w `claim`.
- `unknown→*` jest dozwolone wyłącznie z wierszem rozstrzygnięcia (sekcja 6).

`TRUNCATE` nie uruchamia triggerów wierszowych. Rola aplikacji nie dostaje uprawnienia `TRUNCATE`/`DELETE` na tych tabelach **[DO WERYFIKACJI: rola produkcyjna Neon]**.

---

## 2. Granica auth/własności/CSRF i decyzje zgody (projekt; endpointu/formularza nie budujemy)

**Kanał.** Przyszła akcja `POST` (route handler albo server action) w obszarze `/konto`. Mutacja przez `GET` jest zabroniona.

**Uwierzytelnienie.** Wyłącznie istniejąca sesja konta publicznego. Biblioteka i mechanizm sesji to **[DO WERYFIKACJI]** — `package.json` zawiera `next-auth` i `jose`, kodu auth nie czytano. `userId` pochodzi tylko z sesji serwera. Pole `userId` w ciele żądania powoduje odrzucenie 400. Brak sesji: 401 i zero zapisów.

**Własność.** Wiersz wybieramy wyłącznie przez `(session.userId, purpose, editionKey)`. Obcy wiersz nie jest adresowalny, bo id zgody nie przyjmujemy z zewnątrz. `GRANT` jest dozwolony tylko, gdy:

- `editionKey` jest w rejestrze definicji planera,
- użytkownik ma tracking zmapowany na tę edycję,
- `noticeVersion` jest w serwerowym rejestrze treści zgody.

`WITHDRAW` jest zawsze dozwolony. Bez wiersza jest to no‑op i nie tworzy wiersza.

**CSRF.** Wymagania:

- nagłówek `Origin` dokładnie równy skonfigurowanemu originowi `https://bankmiplaci.pl`; brak `Origin` oznacza odrzucenie,
- `Content-Type: application/json`, co wyklucza prosty formularz cross‑site,
- token CSRF związany z sesją (double‑submit albo mechanizm sesji),
- ciasteczka `SameSite=Lax` lub ostrzejsze.

Wbudowanej ochronie server actions nie ufamy jako jedynej warstwie.

**Ciało żądania:** `{ editionKey, decision: "GRANT"|"WITHDRAW", expectedVersion: int ≥ 0, noticeVersion?, requestId: uuid }`. `requestIdHash = sha256(requestId)`. Odpowiedź zawiera tylko `{ status, version }` — bez adresu i bez listy przypomnień. Obowiązuje limit częstotliwości per użytkownik.

**Domyślność.** Checkbox w przyszłym UI jest domyślnie niezaznaczony. Brak żądania oznacza brak zgody. Rejestracja konta, dołączenie do ściągi i odhaczenia nie wysyłają `GRANT`.

**Transakcja decyzji** (READ COMMITTED, `SET LOCAL lock_timeout='2s'`, `statement_timeout='5s'`):

```text
BEGIN
  row := SELECT * FROM reminder_consents
          WHERE "userId"=$uid AND purpose='CHECKLIST_TASK_REMINDER' AND "editionKey"=$ed
          FOR UPDATE
  IF row AND EXISTS event(row.id, $requestIdHash):        -- idempotent replay
       RETURN stored {status, version}                     (no writes)
  IF decision = GRANT:
       IF row IS NULL:
            IF $expectedVersion <> 0 -> ROLLBACK, 409
            INSERT reminder_consents(version=1, status=GRANTED, decidedAt=now(), source=ACCOUNT_SETTINGS_FORM, noticeVersion=$nv)
              ON CONFLICT ("userId","purpose","editionKey") DO NOTHING
            IF 0 rows -> ROLLBACK, 409                      -- concurrent first grant lost
       ELSE:
            IF row.version <> $expectedVersion -> ROLLBACK, 409
            UPDATE ... SET status=GRANTED, version=version+1, decidedAt=now(), noticeVersion=$nv, updatedAt=now()
  IF decision = WITHDRAW:
       IF row IS NULL OR row.status <> GRANTED -> RETURN no-op (no event)
       IF row.version <> $expectedVersion -> ROLLBACK, 409
       UPDATE ... SET status=WITHDRAWN, version=version+1, decidedAt=now(), updatedAt=now()
       UPDATE reminder_deliveries
          SET state='cancelled', "leaseUntil"=NULL, "nextAttemptAt"=NULL, revision=revision+1
        WHERE "consentId"=row.id AND state IN ('pending','retry','reserved')
  INSERT reminder_consent_events(consentId, version=<new>, decision, source, noticeVersion, requestIdHash, decidedAt=now())
COMMIT
```

Skutki wycofania zgody:

- Wycofanie blokuje `pending`, `retry` i `reserved` w tej samej transakcji.
- Posiadacz anulowanej rezerwacji dostaje przy `begin` wyjątek „Stale reminder attempt” (sprawdzenie `state !== "reserved"` następuje przed `expire`). Dispatcher mapuje go na `blocked/state-unavailable` i nie nawiązuje kontaktu.
- Wiersz `sending` **nie jest zmieniany**. Wywołanie HTTP może już trwać, a `finish` zapisze wynik. Nie obiecujemy cofnięcia maila; przyszły tekst UI ma to mówić wprost („przypomnienie już wysyłane może jeszcze dotrzeć”).

**Ponowna zgoda nie resetuje historii.** Wiersze `cancelled` pozostają terminalne, a `handledKeys` dalej je zwraca. Kwalifikować mogą się tylko nowe klucze, czyli nowe zadania lub terminy. Ręczne „reopen” nie jest projektowane.

**Procedura wymazania** (system/admin, nie endpoint użytkownika). Jedna transakcja jak `WITHDRAW` plus: `status=ERASED`, `source=ERASURE_PROCEDURE`, `userId=NULL`, `version+1` i zdarzenie `ERASE`. Dopiero potem `DELETE users` przechodzi, bo FK ma `RESTRICT`.

Konsekwencja zgodności: każda istniejąca lub przyszła ścieżka usuwania konta musi najpierw wywołać tę procedurę, inaczej usunięcie dostanie błąd FK (fail‑closed). Istnienie takiej ścieżki to **[DO WERYFIKACJI]**.

---

## 3. Transakcje wierszowe claim/begin/finish

### 3.1 Zasady

- Jedna krótka transakcja na jeden klucz. Blokowany jest jeden wiersz ledgera (`FOR UPDATE`) i, dla claim/begin, jeden wiersz zgody (`FOR SHARE`).
- Kolejność blokad jest zawsze: **zgoda → ledger**. To samo robi transakcja `WITHDRAW` (UPDATE zgody, potem UPDATE ledgera), więc nie ma odwrotnej kolejności ani zakleszczenia.
- `SET LOCAL lock_timeout='2s'`, `statement_timeout='5s'`. Prisma interactive transaction: `timeout: 5000`, `maxWait: 2000`.
- Żadna transakcja DB nie trwa podczas HTTP. Między `begin` a `finish` nie ma otwartej transakcji ani blokady.
- Fencing ma trzy warstwy:
  - `token` (uuid nowej próby),
  - oczekiwany `state` sprawdzany przez czystą funkcję przejścia,
  - `revision` w `WHERE` zapisu i w triggerze (`+1`).
- Brak zmiany rekordu oznacza brak `UPDATE`. Rewizja rośnie tylko przy realnej zmianie.
- **Zaufany zegar.** `now` z dispatchera jest porównywany w tej samej transakcji z `clock_timestamp()`. Jeśli `|now − db| > 2 s`, transakcja jest odrzucana bez zapisu (fail‑closed). Lease i `nextAttemptAt` liczone są z `now`, tak jak w obecnym kodzie.

### 3.2 Pseudokod operacji

```text
claim(keyHash, decision, now, consentRef{id, version}):
BEGIN
  assert |now - clock_timestamp()| <= 2s                                -- else ROLLBACK, error
  c   := SELECT status, version FROM reminder_consents WHERE id=$cid FOR SHARE
  ev  := SELECT decision FROM reminder_consent_events WHERE "consentId"=$cid AND version=c.version
  consentCurrent := c AND c.status='GRANTED' AND c.version=$v AND ev.decision='GRANT'
  row := SELECT * FROM reminder_deliveries WHERE "keyHash"=$k FOR UPDATE
  IF row IS NULL -> ROLLBACK, "Reminder was not registered."
  IF row."consentId" <> $cid -> ROLLBACK, "consent mismatch"
  validateReminderRecord(row)                                           -- malformed -> ROLLBACK, no write
  (next, result) := pureClaim(row, {...decision, consent: decision.consent AND consentCurrent}, now)
  IF next = row -> COMMIT; RETURN result
  IF next.state='reserved' -> next.claimConsentVersion := c.version
  n := UPDATE reminder_deliveries SET <next fields>, revision=revision+1
        WHERE "keyHash"=$k AND revision=row.revision
  IF n <> 1 -> ROLLBACK, "reminder revision conflict"
COMMIT; RETURN result (token | null)

begin(keyHash, token, decision, now, consentRef):
  as claim, plus:
  consentCurrent := ... AND c.version = row."claimConsentVersion"       -- withdraw+regrant between claim and begin => not current
  pureBegin keeps its order: token/state stale check -> expire -> consent/valid cancel -> allowed -> sending

finish(keyHash, token, outcome, now):
BEGIN
  assert clock skew
  row := SELECT ... FOR UPDATE
  (next, result) := pureFinish(row, token, outcome, now)                -- no consent fence: contact already happened or not
  write as above (or no write for idempotent sent replay)
COMMIT

register(keyHash, payloadHash, consentId):
  INSERT INTO reminder_deliveries("keyHash","payloadHash","consentId") VALUES (...)
    ON CONFLICT ("keyHash") DO NOTHING RETURNING "keyHash"
  IF none: row := SELECT "payloadHash","consentId" WHERE "keyHash"=$k
           IF row.payloadHash <> $p OR row.consentId <> $cid -> error "Reminder content changed for an existing key."

handledKeys(keyHashes[1..100]):   SELECT "keyHash", state ... WHERE "keyHash" = ANY($1)   -- read only, no lock, no expire
inspect(keyHash):                 SELECT ... ; validateReminderRecord
```

### 3.3 Polityka konfliktów i ponowień

- Zwycięzcę równoległego `claim` wyznacza blokada wiersza. Przegrany po zwolnieniu blokady widzi `reserved` i dostaje `null`, co dispatcher mapuje na `contended`. Koordynator nie robi pętli ponowień.
- `lock_timeout`, `40001`/`40P01`, zerwane połączenie lub `revision conflict` kończą się wyjątkiem. Dispatcher mapuje go na `blocked/state-unavailable` przed kontaktem albo `result-not-recorded` po kontakcie. Automatyczne ponowienie to wyłącznie kolejne uruchomienie dispatchera z pełną ścieżką od świeżego snapshotu.
- **Błąd przed commitem:** brak zmiany.
- **Błąd po commicie, przed odpowiedzią:**
  - `claim` — wiersz zostaje `reserved` z tokenem nieznanym wywołującemu, więc kontaktu nie ma. Po 5 min `expire` cofa `attempt`, a ponowny claim nie zużywa próby kontaktu.
  - `begin` — wiersz zostaje `sending` bez kontaktu; po 5 min `expire` daje `unknown`. To konserwatywna, znana cena: zapis `unknown` mimo braku maila, zgodnie z obecnym „błąd begin blokuje kontakt”.
  - `finish` — ponowienie z tym samym tokenem i receipt jest idempotentne dla `sent`. Dla pozostałych wyników ponowienie rzuca wyjątek, a stan jest już trwały.

### 3.4 Inwarianty utrzymane z obecnego kodu

- Wygaśnięcie `reserved` dekrementuje `attempt` i daje `pending` (token `null`) albo `retry` z `nextAttemptAt=now`. Przejęcie po wygaśnięciu nie zużywa próby kontaktu.
- Wygaśnięcie `sending` daje `unknown`, nigdy `retry`. `finish` po wygaśnięciu leasingu zwraca `unknown` nawet dla `accepted`: receipt jest odrzucany, a stan pozostaje konserwatywny. Opcja zapisu „spóźnionego dowodu” w osobnej tabeli zdarzeń jest **niewybrana** w tym etapie.
- `definitely-not-accepted` daje `retry` z `nextAttemptAt = now + 5 min` przy `attempt < 3`; inaczej `exhausted`. Maksymalnie 3 próby kontaktu.
- `sent` wymaga ścisłego dowodu. Dispatcher (`classifyReminderTransportResult`) akceptuje tylko obiekt `{kind:"accepted", receipt}`, niepusty, ≤256 znaków, bez znaków sterujących. Ledger zapisuje `sha256(receipt)` i `acceptedAt=now`. `undefined`, wyjątek, timeout i dowolny inny kształt oznaczają `ambiguous`, czyli `unknown`.
- `unknown` nigdy samo nie przechodzi do `retry`: ani po upływie czasu, ani po 24 h retencji klucza idempotencji Resend. `claim` zwraca `null`, trigger blokuje przejście bez wiersza rozstrzygnięcia, a `handledKeys` traktuje `unknown` jako obsłużony.
- `handledKeys` nie wywołuje `expire`. Wygasły `sending` nie jest „handled”, dopóki kolejny `claim` nie zapisze `unknown`. Zachowujemy tę semantykę.

### 3.5 Wyścig zgoda / odczyt / zadanie / HTTP — ustalona polityka

Oś czasu dispatchera:

| Krok | Moment |
|---|---|
| T0 | snapshot₁ |
| T1 | `register` |
| T2 | `claim` (fence zgody `FOR SHARE`) |
| T3 | snapshot₂ |
| T4 | `begin` (fence + `claimConsentVersion`) |
| T5 | końcowy planer na nowym zegarze |
| T6 | HTTP |
| T7 | `finish` |

- **Wycofanie zatwierdzone przed commitem T4:** gwarantowany brak kontaktu. Albo `begin` widzi `WITHDRAWN`/inną wersję i anuluje, albo `WITHDRAW` anulował `reserved` i `begin` rzuca „stale”.
- **Wycofanie po commicie T4:** kontakt może nastąpić. Wiersz `sending` nie jest anulowany i zapisuje się prawdziwy wynik. Polityka: akceptujemy co najwyżej jedną wiadomość w locie na klucz i nie obiecujemy jej wstrzymania.
- **Odhaczenie, zakończenie trackingu lub zmiana adresu po T3:** nie są wykrywane przed HTTP. Wiadomość może dotyczyć zadania już odhaczonego. Akceptowane i opisane.
- **Ograniczenie:** nie ma atomowego exactly‑once między bazą a dostawcą poczty. Gwarancje to: co najwyżej jedna próba w locie na klucz, stały `idempotencyKey` `bmp-task-v1/<keyHash>` (deduplikacja Resend tylko w oknie 24 h) oraz brak automatycznego ponowienia po stanie niejednoznacznym.

---

## 4. API per‑key/CAS i minimalny refactor koordynatora

### 4.1 Problem

`ReminderStateStore.transaction(work: (ledger) => T)` przekazuje callbackowi **cały** ledger (`records[]`, globalne `revision`, limit 10 000). Adapter DB, który ładuje i blokuje całą tabelę, byłby fikcją adaptera wierszowego: blokada globalna, liniowy koszt i brak skalowania. **Odrzucone.**

Przegląd pełnego kodu pokazuje, że każda mutująca metoda (`claim`, `begin`, `finish`) zmienia dokładnie jeden rekord (`recordFor(l, rawKey)`). `register` dodaje jeden rekord. `handledKeys` i `inspect` tylko czytają. Semantyka jest więc wierna przy API per‑key.

### 4.2 Wybrane API (do implementacji w następnym etapie)

```ts
export interface ConsentFence { consentId: string; version: number }
export interface ReminderRowContext { consentCurrent: boolean }
export interface ReminderRecordStore {
  /** Locks one row, validates it, runs a synchronous pure transition, writes iff changed (CAS on revision). */
  update<T>(keyHash: string, fence: ConsentFence | null, now: Date,
            work: (record: ReminderRecord, ctx: ReminderRowContext) => T): Promise<T>;
  /** Insert-if-absent; returns "inserted" | "same"; throws on payload or consent mismatch. */
  register(keyHash: string, payloadHash: string, consentId: string | null): Promise<"inserted" | "same">;
  /** Read-only, at most 100 keys, no expiry side effects. */
  read(keyHashes: readonly string[]): Promise<Map<string, ReminderRecord>>;
}
```

- `work` musi być synchroniczny. Zwrócenie `Promise` powoduje wyjątek i rollback, więc pod blokadą nie ma IO.
- `ConsentFence` przekazujemy jako `consentSourceRef` w formacie `<consentId>@v<version>`. To pole już istnieje w `ReminderSnapshot` jako niepusty string, więc nie zmieniamy kształtu snapshotu.

### 4.3 Minimalny refactor (opis, nie wdrażać teraz)

1. W `checklistReminderState.ts`:
   - Wydzielić `validateReminderRecord(r)` z pętli `validateReminderLedger`. Walidator ledgera woła go w pętli i zostaje dla file store.
   - Zamienić `this.store.transaction((l) => { const r = recordFor(l, rawKey); … })` na `this.store.update(reminderHash(rawKey), fence, now, (r, ctx) => { … })`. Ciała `claim`, `begin` i `finish` zostają bez zmian, poza wejściem `consent` liczonym jako `decision.consent && ctx.consentCurrent`.
   - `register` przechodzi na `store.register`, a `handledKeys` i `inspect` na `store.read`.
2. Rozszerzyć `FreshReminderDecision` o opcjonalne `consentRef?: string`, a `register` o opcjonalny trzeci argument. Dispatcher przekazuje `first.value.consentSourceRef` do `register`/`claim` i `second.value.consentSourceRef` do `begin`. Zmiana dotyczy tylko przekazania argumentów; logika dispatchera się nie zmienia.
3. Adapter DB wymaga `consentRef`. Jego brak lub nieparsowalna postać daje wyjątek (fail‑closed).
4. **Shim zgodności** `LedgerRecordStore` implementuje `ReminderRecordStore` na istniejącym `ReminderStateStore.transaction`:
   - `update` wykonuje `transaction(l => work(recordFor(l), {consentCurrent: true}))`.
   - Pilot file store i obecne testy (20 testów stanu i 25 testów dispatchera) mają przejść bez zmian asercji.
   - Shim ignoruje fence, co jest równoważne obecnemu zachowaniu.

Przypadki migracji:

- **Brak importu z file ledger.** Pilot nie zawiera danych produkcyjnych; niczego nie wysłano ani nie zapisano w DB. DB startuje pusta.
- Globalne `revision` ledgera znika w DB. Zastępuje je `revision` per wiersz, a testy asercji na globalnym `revision` dotyczą tylko shimu.
- Limit 10 000 rekordów (ochrona rozmiaru pliku) nie ma odpowiednika w DB. Zastępują go ograniczone zapytania: pojedynczy klucz i `read` ≤ 100.
- `remindedGroupIndexes` nie jest migrowane i nie jest zgodą.

### 4.4 Porównanie ograniczeń walidatora z DB

| Reguła w `validateReminderLedger` | Odpowiednik DB | Uwagi |
|---|---|---|
| `format`, `revision ≥ 0`, `records ≤ 10000`, dokładny zestaw kluczy | brak (nie dotyczy tabeli) | `revision` per wiersz ≥ 0; adapter mapuje wiersz na dokładny kształt `ReminderRecord` (bez `consentId`/`revision`/`claimConsentVersion`) |
| `keyHash`/`payloadHash` `^[a-f0-9]{64}$`, unikalny `keyHash` | `char(64)` + CHECK, PK | `payloadHash` dodatkowo niezmienny (trigger) |
| `state` ∈ 8 wartości | enum `ReminderDeliveryState` | wartości identyczne jak w TS |
| `attempt` safe int 0..3 | `smallint CHECK 0..3` | |
| `token` null lub `^[a-f0-9-]{36}$` | `uuid` | PG akceptuje też wielkie litery, ale zwraca kanoniczne małe; `randomUUID` daje małe; adapter waliduje regexem po odczycie |
| daty: ISO z ms, `toISOString() === d` | `timestamptz(3)` | precyzja 3 gwarantuje roundtrip |
| `receiptHash` null lub hash | CHECK | |
| aktywny ⇔ `leaseUntil`; aktywny ⇒ token i attempt>0 | `rd_active_lease_chk`, `rd_active_token_chk` | DB dodatkowo wymaga `claimConsentVersion` dla aktywnych |
| `retry` ⇔ `nextAttemptAt` | `rd_retry_date_chk` | |
| `sent` ⇔ `acceptedAt` i `receiptHash`; inne bez nich | `rd_sent_evidence_chk`, `rd_no_stray_evidence` | |
| `pending` ⇒ attempt 0, token null | `rd_pending_chk` | |
| retry/sent/unknown/exhausted ⇒ attempt>0 i token | `rd_attempted_chk` | `cancelled` celowo bez ograniczeń (z `pending`: 0/null; z `retry`/`reserved`: token zostaje) |
| — | trigger przejść, terminalność, niezmienność, brak DELETE | dodatkowe w DB; zgodne z przejściami kodu |

Odczyt wiersza naruszającego walidację (np. po ręcznej ingerencji z wyłączonym CHECK) rzuca wyjątek. Brak tabeli, niedostępna DB i błąd odczytu też rzucają wyjątek. Adapter nigdy nie tworzy pustego baseline ani tabeli w locie.

---

## 5. Świeży snapshot loader

Jedna transakcja `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` (jedna spójna rewizja bazy) z `statement_timeout='5s'`. Wybiera tylko potrzebne kolumny:

1. `clock_timestamp()`. Wymóg: `|db − evaluatedAt| ≤ 2 s`. `evaluatedAt` jest dokładnie wartością `requested` przekazaną przez dispatcher, a limit ≤ 30 s od początku oceny egzekwuje dispatcher (już w kodzie).
2. `user_promotion_tracking`: `id, "userId", "promotionId", "accountOpenedAt", "completedAt"` dla dokładnego `trackingId`. Brak wiersza daje błąd.
3. `editionKey` z rejestru definicji planera dla tej promocji. Brak mapowania lub edycja niewspierana: wynik `blocked`. Nie zgadujemy edycji z id oferty.
4. `users`: tylko `email`. Bez `passwordHash`, `name` i dat aktywności.
5. Zgoda: `reminder_consents` po `(userId, purpose, editionKey)` z JOIN `reminder_consent_events` po `(consentId, version)`. `consent = status='GRANTED' ∧ event.decision='GRANT' ∧ noticeVersion ∈ rejestr`. `consentSourceRef = "<id>@v<version>"`. Bez wiersza: `consent=false`, a `consentSourceRef` to stały, niepusty marker `"none"` (tylko dlatego, że dispatcher wymaga niepustego stringa; adapter DB odrzuci go jako fence).
6. `checklist_steps` promocji: `id, "monthLabel", "availableUntil", title, "rewardCents", "order"` uporządkowane po `order`.
7. `checklist_progress`: `"stepId", "checkedAt"` dla `userId` i tych kroków.
8. Kalendarz, receipt i intencje: w obecnym schemacie **nie ma** dla nich tabel. Loader zwraca je jawnie jako niedostępne, a planer daje `blocked`/`unsupported` dla zadań, które ich wymagają. Pola `TaskReminderInput` to **[DO WERYFIKACJI]**. Brak potwierdzonego kalendarza, wydania bonu albo dowodu wynagrodzeń zostaje jawny i nie powstają fikcyjne terminy.

Zasady:

- Odhaczenia to wyłącznie „użytkownik oznaczył krok”. Planer nie interpretuje ich jako płatności, wpływu ani wypłaty.
- Loader nie czyta i nie otwiera `affiliateUrl` ani żadnych linków afiliacyjnych; wiadomość zawiera wyłącznie `/konto`.
- Loader nie loguje adresu.
- Otwarte ryzyko produktowe: schemat nie ma weryfikacji adresu e‑mail. Bramka produkcyjna to decyzja właściciela (wymagana weryfikacja albo świadoma akceptacja).

---

## 6. `unknown`, anulowanie, zmiana payloadu, retencja, usunięcie

**Rozstrzygnięcie `unknown`.** Przyszła procedura, nie endpoint publiczny:

- Wykonawca: `AdminUser` z rolą `ADMIN`.
- Wejście: `keyHash`, `expectedRevision`, decyzja, `evidenceRefHash` (skrót pozytywnego dowodu dostawcy, np. eksportu logu dostawcy z `idempotencyKey` i znacznikiem czasu; surowego dowodu nie zapisujemy) oraz `requestId`.
- Transakcja: `SELECT … FOR UPDATE`, wymagany `state='unknown'` i `revision=expected`. Potem `INSERT` rozstrzygnięcia z `appliedRevision = revision+1`. Ten sam `requestIdHash` przy ponowieniu zwraca zapisany wynik bez zmian. Na koniec `UPDATE`:
  - `PROVIDER_CONFIRMED_ACCEPTED` → `sent`, `receiptHash` z dowodu, `acceptedAt = decidedAt`;
  - `PROVIDER_CONFIRMED_NOT_ACCEPTED` → `retry` z `nextAttemptAt = now` przy `attempt < 3`, inaczej `exhausted`.
- Brak dowodu to nie odmowa: wiersz zostaje `unknown` bezterminowo. Uzyskanie pozytywnego dowodu może być niemożliwe i jest to akceptowane.
- Kod odzyskiwania nie powstaje w tym etapie.

**`cancelled`** jest terminalne. Ani ponowna zgoda, ani zmiana danych nie resetuje historii.

**Zmiana payloadu dla istniejącego klucza.** `register` rzuca wyjątek, dispatcher daje `blocked`, wiadomość nie wychodzi i nie powstaje automatyczny nowy klucz. Konsekwencje wprost:

- Zmiana adresu odbiorcy albo szablonu blokuje dotąd niezakończone klucze.
- Zmiana przestrzeni kluczy (np. `v2`) groziłaby ponowną wysyłką już obsłużonych przypomnień, dlatego wymaga osobnej, jawnej decyzji.
- Wdrożenie zmiany szablonu odbywa się przy zerze aktywnych wierszy albo z akceptacją blokady.

**Retencja i usunięcie.**

- Wiersze ledgera to tombstone'y. `DELETE` blokuje trigger, a aplikacja nie ma uprawnień.
- Usunięcie trackingu (Cascade od użytkownika) nie dotyka ledgera, bo nie ma do niego FK.
- Usunięcie użytkownika wymaga procedury wymazania (sekcja 2). Tombstone'y zostają, więc ponowny `register` tego samego klucza trafia na istniejący wiersz i nie daje duplikatu.
- Ryzyko **[DO WERYFIKACJI]**: jeśli task key zawiera `trackingId`, ponowne dołączenie do promocji tworzy nowe klucze. Wymagana jest decyzja, czy klucz ma być stabilny względem (użytkownik, edycja, zadanie, termin).
- Przyszłe czyszczenie wierszy jest możliwe tylko osobną, autoryzowaną migracją: po wycofaniu edycji z rejestru planera i po potwierdzeniu, że planer zwraca dla niej `unsupported`.

**Minimalizacja (decyzje techniczne, nie gwarancja prawna).**

- Brak adresu, treści, IP i user agenta w nowych tabelach.
- `keyHash` (`sha256` surowego klucza z identyfikatorami) i `consentId` są danymi pseudonimowymi, nie anonimowymi. Pozostawienie `sha256` zamiast HMAC wynika ze zgodności z `reminderHash` i `idempotencyKey`.
- Wiersz `ERASED` nie ma `userId`.
- Ocena prawna nie jest częścią tego dokumentu.

---

## 7. Plan testów na odizolowanej pustej bazie

### 7.1 Środowisko i strażnik tożsamości

- Restricted worker nie uruchamia PostgreSQL. Testy wykonuje Codex lub właściciel na **jednorazowym** lokalnym serwerze (kontener lub instancja lokalna).
- Nigdy produkcyjny Neon, nigdy kopia klientów, nigdy `DATABASE_URL`.
- Harness czyta wyłącznie `REMINDER_IT_DATABASE_URL` i przerywa **przed jakimkolwiek zapisem**, jeśli:
  - URL jest równy `DATABASE_URL`,
  - host nie jest `localhost`/`127.0.0.1`/`::1`/jawnie skonfigurowaną nazwą kontenera,
  - host pasuje do `/neon|vercel|amazonaws|supabase|render|railway/i`,
  - nazwa bazy nie pasuje do `^bmp_reminder_it_[0-9a-f]{8}$`,
  - `SELECT current_database()` ≠ oczekiwana nazwa,
  - schemat `public` nie jest pusty przed nałożeniem kandydata.
- Po nałożeniu harness tworzy `__bmp_it_sentinel(nonce)` z losowym nonce i sprawdza go przed każdym plikiem testów.
- Raport zawiera tylko nazwę bazy i wyniki — bez URL, haseł i nonce.
- Schemat kandydata to minimalne tabele bazowe (`users`, `admin_users`, `banks`, `promotions`, `checklist_steps`, `checklist_progress`, `user_promotion_tracking`) z obecnego schematu oraz DDL z sekcji 1.3. Kandydat nie jest migracją produkcyjną. Bramka: zero dryfu `prisma migrate diff` między kandydatem Prisma a bazą.
- Fikstury są wyłącznie syntetyczne: `it-u1@example.invalid`, id `it_u1`, `it_tr1`, bank „IT Bank”, `editionKey` `it-edition-1`, `noticeVersion` `it-notice-1`. Fałszywy transport zlicza wywołania; Resend i sieć nie są używane.
- Dwa **prawdziwe** połączenia to dwie instancje `PrismaClient` z `connection_limit=1` (bez nowych zależności) oraz bariera w procesie. Trzecie połączenie administracyjne służy do `pg_terminate_backend`.
- Upływ czasu testujemy fiksturami z datami względem `clock_timestamp()` (INSERT poprawnych wierszy z `leaseUntil` lub `nextAttemptAt` w przeszłości lub przyszłości), bo strażnik skew odrzuca sztucznie przesunięty zegar.

### 7.2 Macierz scenariuszy (wszystkie wyniki: NOT_RUN)

| ID | Wejście (syntetyczne) | Akcja | Oczekiwane wiersze / stan | Wynik |
|---|---|---|---|---|
| S01 no‑opt‑in | U1 + tracking, brak zgody | loader + dispatch | `consent=false`; `blocked/no-consent`; consents 0, deliveries 0, transport 0 | NOT_RUN |
| S02 grant | jw. | GRANT `expectedVersion=0` | consents 1 (`GRANTED`, v1), events 1, deliveries 0 | NOT_RUN |
| S03 grant replay | po S02 | ten sam `requestId` | bez zmian (v1, events 1), ta sama odpowiedź | NOT_RUN |
| S04 grant race | brak zgody | 2 połączenia GRANT v0 równolegle | consents 1 (v1), events 1; drugi 409 | NOT_RUN |
| S05 foreign user | U1 zgoda; sesja U2 | GRANT/WITHDRAW z `userId=U1` w ciele; loader trackingu U1 przy zgodzie tylko U2 | 400, wiersze U1 bez zmian; U1 `consent=false` | NOT_RUN |
| S06 timestamp‑only | INSERT `GRANTED` bez zdarzenia v1 (oraz z nieznanym `noticeVersion`) | loader | `consent=false`; deliveries 0 | NOT_RUN |
| S07 CHECK consent | INSERT `GRANTED` z `source=NULL`/`noticeVersion NULL`; `ERASED` z userId | INSERT | naruszenie CHECK; 0 wierszy | NOT_RUN |
| S08 withdraw | zgoda v1; deliveries: pending, retry, reserved, sending, sent | WITHDRAW v1 | consent v2 `WITHDRAWN`; events 2; 3 wiersze → `cancelled` (rev+1); sending/sent bez zmian | NOT_RUN |
| S09 re‑grant | po S08 | GRANT v2 | v3 `GRANTED`; `cancelled` pozostają; `handledKeys` zawiera je | NOT_RUN |
| S10 register | zgoda | register K1/P1 | deliveries 1: pending, attempt 0, token null, rev 0 | NOT_RUN |
| S11 reapply | po S10 | register K1/P1 ×2 | 1 wiersz, rev 0 | NOT_RUN |
| S12 payload conflict | po S10 | register K1/P2; bezpośredni UPDATE `payloadHash` | błąd; trigger odrzuca; `payloadHash`=P1 | NOT_RUN |
| S13 parallel claim | K1 pending | 2 połączenia `claim` z barierą, ×50 iteracji | zawsze dokładnie 1 token; reserved, attempt 1, rev 1; drugi `null` | NOT_RUN |
| S14 parallel dispatch | K1 gotowy | 2× `dispatch` równolegle | transport dokładnie 1; drugi `contended` lub `handled` | NOT_RUN |
| S15 stale begin | reserved z leaseUntil < db; B przejmuje | A `begin(staryToken)` | wyjątek „Stale”; wiersz reserved z tokenem B | NOT_RUN |
| S16 stale finish | sending z tokenem B | `finish(tokenA)` | wyjątek; wiersz bez zmian | NOT_RUN |
| S17 reserved expiry reclaim | reserved attempt 1, lease minął | `claim` | reserved, attempt **1**, nowy token, rev+1 | NOT_RUN |
| S18 begin !eligible | reserved attempt 1 | `begin` z `eligible=false` | pending, attempt 0, token null; transport 0 | NOT_RUN |
| S19 sending timeout | sending, lease minął | `claim` | `unknown`; wynik `null`; transport 0 | NOT_RUN |
| S20 unknown nie retry | unknown | `claim` z czasem po >24 h od utworzenia | `null`; `unknown`; rev bez zmian | NOT_RUN |
| S21 retry/limit | sending attempt 1 | `finish(definitely-not-accepted)`; `claim` przed i po `nextAttemptAt`; powtórzyć do attempt 3 | retry +5 min; przed → null; po → reserved attempt 2; trzecia odmowa → `exhausted` | NOT_RUN |
| S22 accepted | sending | `finish(accepted, R)`; powtórz z R; potem R2 | sent, `receiptHash=sha256(R)`; replay → sent bez rev+1; R2 → wyjątek | NOT_RUN |
| S23 late accepted | sending, lease minął | `finish(accepted)` | `unknown`; brak `receiptHash` | NOT_RUN |
| S24 fault before commit | pending | `claim`, terminate backend przed COMMIT | pending, rev 0 | NOT_RUN |
| S25 fault after commit | pending | `claim` commit, hook rzuca przed zwrotem (symulacja po stronie klienta) | reserved w DB; dispatcher `blocked`; transport 0; po lease → reclaim attempt 1 | NOT_RUN |
| S26 begin lost response | reserved | `begin` commit, hook rzuca | sending; transport 0; po lease → `unknown` | NOT_RUN |
| S27 restart | stany mieszane | nowy proces, nowa pula | stany i `handledKeys` identyczne | NOT_RUN |
| S28 clock skew | pending | `claim` z `now = db + 10 s` | odrzucone; rev 0 | NOT_RUN |
| S29 backwards clock | dispatcher | zegar cofa się | `blocked`; 0 zapisów | NOT_RUN |
| S30 deadline crossing | begin tuż przed północą Europe/Warsaw | końcowy planer po begin | `finish(ambiguous)` → `unknown`; transport 0 | NOT_RUN |
| S31 withdraw claim→begin | reserved | WITHDRAW na drugim połączeniu, potem `begin` | `cancelled`; `begin` stale; transport 0 | NOT_RUN |
| S32 withdraw+regrant claim→begin | reserved (claimConsentVersion 1) | WITHDRAW + GRANT (v3), potem `begin` | `cancelled`; transport 0 | NOT_RUN |
| S33 lock order | begin trzyma `FOR SHARE` | WITHDRAW równolegle | WITHDRAW czeka; po commit begin: sending nietknięty; brak deadlocka; transport ≤1 (udokumentowany wyścig) | NOT_RUN |
| S34 malformed state | INSERT: reserved bez lease; attempt 4; token nie‑uuid; sent bez receipt | INSERT | naruszenia CHECK; 0 wierszy | NOT_RUN |
| S35 malformed read | schemat testowy bez CHECK, wiersz niespójny | `inspect`/`claim` | wyjątek walidacji; brak zapisu; dispatcher `blocked` | NOT_RUN |
| S36 missing table / DB down | brak tabeli; zły port | dispatch | `blocked/state-unavailable`; tabela nie powstaje | NOT_RUN |
| S37 illegal transitions | sent / cancelled / exhausted / unknown | bezpośredni UPDATE stanu; DELETE | trigger odrzuca; wiersz bez zmian | NOT_RUN |
| S38 unknown resolution | unknown | ADMIN: ACCEPTED z dowodem; replay; bez dowodu; rola EDITOR; zły `expectedRevision` | sent + 1 wiersz rozstrzygnięcia; replay bez zmian; pozostałe odrzucone, `unknown` | NOT_RUN |
| S39 erasure | U1: sent + pending | procedura wymazania, potem DELETE user | pending → cancelled; consent ERASED, userId NULL; user usunięty; deliveries bez zmiany liczby; ponowny register K → istniejący wiersz, `handled` | NOT_RUN |
| S40 delete bez procedury | U1 z zgodą | DELETE user | błąd FK; nic nie usunięte | NOT_RUN |
| S41 tracking delete | tracking z deliveries | DELETE tracking | deliveries bez zmian | NOT_RUN |
| S42 loader consistency | równoległy INSERT progress podczas snapshotu | loader | wynik spójny z jedną rewizją | NOT_RUN |
| S43 loader gaps | brak mapowania edycji / brak kalendarza | loader + dispatch | `blocked`/`not-eligible`; register 0; brak fikcyjnych terminów | NOT_RUN |
| S44 handledKeys limit | 101 kluczy | `read` | odrzucone | NOT_RUN |
| S45 PII scan | po pełnym przebiegu | SELECT wszystkich nowych tabel | brak `@`, HTML, tematu i surowego receipt w kolumnach | NOT_RUN |
| S46 identity guard | URL z hostem neon / zła nazwa DB / niepusty schemat | start harnessu | przerwanie przed zapisem; brak sekretów w raporcie | NOT_RUN |

Razem 46 scenariuszy, wynik 0 PASS. Status całości: **NOT_RUN**.

---

## 8. Następny zakres implementacyjny i bramki odbioru

Zakres (kolejny, osobno zlecony etap):

1. Kandydat Prisma i SQL (sekcja 1) jako migracja wyłącznie na bazie jednorazowej. Bez `prisma migrate deploy` na produkcję.
2. `validateReminderRecord`, `ReminderRecordStore`, shim `LedgerRecordStore` i refactor koordynatora (sekcja 4.3).
3. `PrismaReminderRecordStore` (sekcja 3) z `$queryRaw` dla `FOR UPDATE`/`FOR SHARE`, timeoutami i strażnikiem skew.
4. Loader snapshotu (sekcja 5) — read‑only.
5. Harness `tests/db/reminder-*.test.ts` ze strażnikiem tożsamości i macierzą z sekcji 7.

Poza zakresem: endpoint i formularz zgody, procedura wymazania jako kod, rozstrzyganie `unknown` jako kod, adapter Resend, scheduler, aktywacja produkcyjna.

Bramki odbioru (wszystkie muszą być spełnione; obecnie NOT_RUN):

- G1: istniejący `npm test` bez regresji. Testy stanu i dispatchera przechodzą przez shim bez zmian asercji.
- G2: S01–S46 PASS na jednorazowej bazie, z dowodem strażnika tożsamości i bez sekretów w raporcie.
- G3: zero dryfu `prisma migrate diff` kandydata.
- G4: przegląd potwierdza punkty **[DO WERYFIKACJI]**: pola `TaskReminderInput`, skład task key, mechanizm sesji, ścieżka usuwania konta, rola DB bez `DELETE`/`TRUNCATE`.
- G5: decyzje właściciela: weryfikacja adresu e‑mail, treść i `noticeVersion` zgody, polityka zmiany szablonu i odbiorcy wobec konfliktu payloadu, akceptacja okna wyścigu po `begin`.
- G6: dopiero po G1–G5 osobna decyzja o migracji produkcyjnej. Ten dokument jej nie autoryzuje.
