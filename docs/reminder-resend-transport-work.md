# Adapter Resend dla przypomnień (izolowany, v1)

TASK_KEY: `bmp-reminder-provider-adapter-isolated-v1-20261004`

Status: kod i testy napisane, **testy NOT_RUN**. Nic nie jest jeszcze podłączone do sendera, crona ani DB.

## Pliki

- `src/lib/reminderResendTransport.ts`: adapter.
- `tests/reminder-resend-transport.test.ts`: testy `node:test` i `assert/strict` na sztucznym SDK.

## API

- `createResendReminderTransport(client)`: `client` to strukturalny obiekt `{ emails: { send(payload, { idempotencyKey }) } }`.
  Brakujący lub zły klient powoduje `ReminderTransportConfigError` ze stałym komunikatem, bez danych.
- `transport.send(message, { idempotencyKey })` zwraca `Promise<ProviderOutcome>`, zgodne strukturalnie z `ReminderTransport`.
- `mapResendSendResponse(response)`: czyste mapowanie odpowiedzi, wyeksportowane do testów i integracji.

## Zachowanie

- Klucz musi pasować do `^bmp-task-v1/[0-9a-f]{64}$`. Adapter niczego nie generuje: ani UUID, ani klucza próby.
- `from`, `to` i `subject` muszą być niepustymi stringami bez znaków C0/DEL (ochrona przed wstrzyknięciem nagłówków). `html` musi być niepustym stringiem.
- Przy błędnym kluczu lub payloadzie promise jest odrzucany z `ReminderTransportInputError` (`reason`: `invalid-idempotency-key` / `invalid-message`), **zanim SDK zostanie wywołane**. Komunikat błędu nie zawiera danych.
- Payload to świeża kopia dokładnie czterech pól. Dodatkowe pola, np. `replyTo`, są pomijane. Wejście nie jest modyfikowane.
- SDK jest wywoływane dokładnie raz: `emails.send(payload, { idempotencyKey })`.
- Wynik `accepted` powstaje tylko dla `{ data: { id }, error: null }`, i tylko gdy `id` jest niepustym stringiem o długości ≤256, bez C0/DEL i niebędącym samymi spacjami. Pole `headers` jest ignorowane.
- Wszystko inne daje `ambiguous`: wyjątek, void/null, nieznany kształt, jednoczesne `data` i `error`, a także każda odpowiedź z błędem bez względu na `name`/`statusCode`/treść.
- **Ta wersja nigdy nie zwraca `definitely-not-accepted`.** Brak potwierdzonego kontraktu, który pozwalałby wywnioskować pewną odmowę, więc ścieżka „max 3 tylko po pewnej odmowie” w dispatcherze pozostaje dla tego adaptera nieaktywna.
- Adapter nie ponawia wysyłki, nie ustawia timeoutu i niczego nie loguje. Wynik zawiera tylko `kind` i `receipt`.

## Ograniczenia

- `accepted` oznacza przyjęcie przez API, a nie dostarczenie czy przeczytanie wiadomości.
- Według dokumentacji Resend (sprawdzonej przez właściciela 04.10, w workerze bez sieci) klucz idempotencji jest przechowywany przez 24h. Po tym czasie nie ma gwarancji dokładnie jednego maila. Stan `ambiguous` nie odblokowuje się sam.
- Zgodność typu z `resend@^6.22.0` (`emails.send(payload, options?)`, `Response<T>` z `headers`) ustalono przez odczyt `node_modules/resend/dist/index.d.mts`. Adapter nie importuje typów Resend. `tsc` NOT_RUN.
- Istniejący `sendEmail` (`src/lib/email.ts`) nie jest używany. Przechwytuje wyjątki i zwraca void, więc nie nadaje się do rozstrzygania wyniku.
- Test „import nie wysyła” podmienia `globalThis.fetch` na czas zestawu i sprawdza źródło modułu (brak `resend`, env i `console`).
