import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

type TransportModule = typeof import("../src/lib/reminderResendTransport");

const SOURCE_PATH = path.resolve(process.cwd(), "src/lib/reminderResendTransport.ts");
const KEY = `bmp-task-v1/${"a1b2c3d4".repeat(8)}`;
const RECEIPT = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";
const SECRET_TEXT = "re_SECRET_api_key postgres://user:pass@db.internal/prod recipient@example.test";

const MESSAGE = Object.freeze({
  from: "Bankmiplaci <noreply@example.test>",
  to: "recipient@example.test",
  subject: "Przypomnienie: termin warunku promocji",
  html: "<p>Termin mija jutro.</p>"
});

let mod: TransportModule;
let fetchCalls = 0;
let fetchCallsAfterImport = -1;
const originalFetch = globalThis.fetch;

before(async () => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("network disabled in tests");
  }) as typeof fetch;
  mod = await import("../src/lib/reminderResendTransport");
  fetchCallsAfterImport = fetchCalls;
});

after(() => {
  globalThis.fetch = originalFetch;
});

type Call = { payload: unknown; options: unknown; self: unknown };

function fakeClient(impl: (payload: unknown, options: unknown) => unknown) {
  const calls: Call[] = [];
  const emails = {
    send(this: unknown, payload: unknown, options: unknown) {
      calls.push({ payload, options, self: this });
      return impl(payload, options) as Promise<unknown>;
    }
  };
  return { client: { emails }, emails, calls };
}

const ok = () => Promise.resolve({ data: { id: RECEIPT }, error: null, headers: null });

async function withSilencedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; consoleCalls: number }> {
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const originals = methods.map((name) => console[name]);
  let consoleCalls = 0;
  for (const name of methods) {
    console[name] = () => {
      consoleCalls += 1;
    };
  }
  try {
    const result = await fn();
    return { result, consoleCalls };
  } finally {
    methods.forEach((name, i) => {
      (console as unknown as Record<string, unknown>)[name] = originals[i];
    });
  }
}

test("import modułu nie wysyła i nie dotyka sieci", () => {
  assert.equal(fetchCallsAfterImport, 0);
  const { client, calls } = fakeClient(ok);
  mod.createResendReminderTransport(client);
  assert.equal(calls.length, 0);
  assert.equal(fetchCalls, 0);
});

test("źródło adaptera jest samodzielne: bez SDK runtime, env, sendEmail i logowania", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  assert.doesNotMatch(source, /from\s+["']resend["']/);
  assert.doesNotMatch(source, /require\(/);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /new\s+Resend/);
  assert.doesNotMatch(source, /\.\/email["']/);
  // \b: the app's sendEmail() helper, not the substring inside "ResendEmailsClientLike".
  assert.doesNotMatch(source, /\bsendEmail\b/);
  assert.doesNotMatch(source, /console\./);
  assert.doesNotMatch(source, /setTimeout|randomUUID/);
});

test("zweryfikowany sukces SDK daje accepted z receipt = data.id", async () => {
  const { client } = fakeClient(ok);
  const outcome = await mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY });
  assert.deepEqual(outcome, { kind: "accepted", receipt: RECEIPT });
});

test("receipt o długości dokładnie 256 jest akceptowany", async () => {
  const id = "x".repeat(256);
  const { client } = fakeClient(() => Promise.resolve({ data: { id }, error: null }));
  const outcome = await mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY });
  assert.deepEqual(outcome, { kind: "accepted", receipt: id });
});

test("dokładny payload i options, jedno wywołanie SDK z zachowanym this", async () => {
  const { client, emails, calls } = fakeClient(ok);
  await mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY });
  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.deepEqual(call.payload, {
    from: MESSAGE.from,
    to: MESSAGE.to,
    subject: MESSAGE.subject,
    html: MESSAGE.html
  });
  assert.deepEqual(Object.keys(call.payload as object).sort(), ["from", "html", "subject", "to"]);
  assert.notEqual(call.payload, MESSAGE);
  assert.deepEqual(call.options, { idempotencyKey: KEY });
  assert.equal(call.self, emails);
});

test("dodatkowe pola wiadomości nie trafiają do payloadu", async () => {
  const { client, calls } = fakeClient(ok);
  const extended = Object.freeze({ ...MESSAGE, replyTo: "other@example.test", bcc: "spy@example.test" });
  await mod.createResendReminderTransport(client).send(extended, { idempotencyKey: KEY });
  assert.deepEqual(Object.keys(calls[0]!.payload as object).sort(), ["from", "html", "subject", "to"]);
});

test("ponowne wywołanie adaptera używa identycznego klucza i payloadu; adapter sam nie ponawia", async () => {
  let attempt = 0;
  const { client, calls } = fakeClient(() => {
    attempt += 1;
    return attempt === 1 ? Promise.reject(new Error("socket hang up")) : ok();
  });
  const transport = mod.createResendReminderTransport(client);

  const first = await transport.send(MESSAGE, { idempotencyKey: KEY });
  assert.deepEqual(first, { kind: "ambiguous" });
  assert.equal(calls.length, 1, "brak własnego retry po wyjątku");

  const second = await transport.send(MESSAGE, { idempotencyKey: KEY });
  assert.deepEqual(second, { kind: "accepted", receipt: RECEIPT });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]!.payload, calls[1]!.payload);
  assert.deepEqual(calls[0]!.options, { idempotencyKey: KEY });
  assert.deepEqual(calls[1]!.options, { idempotencyKey: KEY });
});

test("error response wywołuje SDK dokładnie raz (bez ponowienia)", async () => {
  const { client, calls } = fakeClient(() =>
    Promise.resolve({ data: null, error: { name: "rate_limit_exceeded", statusCode: 429, message: "slow down" } })
  );
  const outcome = await mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY });
  assert.deepEqual(outcome, { kind: "ambiguous" });
  assert.equal(calls.length, 1);
});

test("zamrożone wejście pozostaje niezmienione, nawet gdy SDK mutuje payload", async () => {
  const snapshot = { ...MESSAGE };
  const options = Object.freeze({ idempotencyKey: KEY });
  const { client } = fakeClient((payload) => {
    (payload as Record<string, unknown>).to = "mutated@example.test";
    (payload as Record<string, unknown>).html = "<p>zmienione</p>";
    return ok();
  });
  const outcome = await mod.createResendReminderTransport(client).send(MESSAGE, options);
  assert.equal(outcome.kind, "accepted");
  assert.deepEqual({ ...MESSAGE }, snapshot);
  assert.deepEqual({ ...options }, { idempotencyKey: KEY });
  assert.ok(Object.isFrozen(MESSAGE));
});

test("fabryka blokuje brakującego lub złego klienta ogólnym błędem bez danych", () => {
  const throwingGetter = {
    get emails(): never {
      throw new Error(SECRET_TEXT);
    }
  };
  const badClients: unknown[] = [
    undefined,
    null,
    "re_SECRET_api_key",
    42,
    {},
    { emails: null },
    { emails: {} },
    { emails: { send: "not-a-function" } },
    throwingGetter
  ];
  for (const bad of badClients) {
    assert.throws(
      () => mod.createResendReminderTransport(bad as never),
      (error: unknown) => {
        assert.ok(error instanceof mod.ReminderTransportConfigError);
        assert.equal((error as Error).message, "Reminder transport: invalid provider client.");
        assert.ok(!(error as Error).message.includes("re_"));
        return true;
      }
    );
  }
});

test("niepoprawny klucz idempotencji: odrzucenie przed kontaktem, zero wywołań SDK", async () => {
  const hex64 = "a1b2c3d4".repeat(8);
  const badKeys: unknown[] = [
    undefined,
    null,
    "",
    42,
    `bmp-task-v1/${hex64.slice(1)}`,
    `bmp-task-v1/${hex64}0`,
    `bmp-task-v1/${hex64.toUpperCase()}`,
    `bmp-task-v2/${hex64}`,
    `BMP-TASK-V1/${hex64}`,
    `bmp-task-v1/${hex64}\n`,
    ` bmp-task-v1/${hex64}`,
    `bmp-task-v1/${"g".repeat(64)}`,
    "6f1c2a3b-0d4e-4f5a-8b9c-1d2e3f4a5b6c"
  ];
  for (const key of badKeys) {
    const { client, calls } = fakeClient(ok);
    const transport = mod.createResendReminderTransport(client);
    await assert.rejects(
      transport.send(MESSAGE, { idempotencyKey: key } as never),
      (error: unknown) => {
        assert.ok(error instanceof mod.ReminderTransportInputError);
        assert.equal((error as InstanceType<TransportModule["ReminderTransportInputError"]>).reason, "invalid-idempotency-key");
        assert.ok(!(error as Error).message.includes(hex64));
        return true;
      }
    );
    assert.equal(calls.length, 0);
  }
  for (const options of [undefined, null, "string", {}]) {
    const { client, calls } = fakeClient(ok);
    await assert.rejects(
      mod.createResendReminderTransport(client).send(MESSAGE, options as never),
      mod.ReminderTransportInputError
    );
    assert.equal(calls.length, 0);
  }
});

test("niepoprawny payload: odrzucenie przed kontaktem, zero wywołań SDK, bez adresów w błędzie", async () => {
  const badMessages: unknown[] = [
    undefined,
    null,
    "message",
    {},
    { ...MESSAGE, from: "" },
    { ...MESSAGE, from: "   " },
    { ...MESSAGE, to: undefined },
    { ...MESSAGE, to: ["recipient@example.test"] },
    { ...MESSAGE, to: "recipient@example.test\r\nBcc: spy@example.test" },
    { ...MESSAGE, subject: "" },
    { ...MESSAGE, subject: "Temat\nX-Injected: 1" },
    { ...MESSAGE, subject: 7 },
    { ...MESSAGE, html: "" },
    { ...MESSAGE, html: "  " },
    { ...MESSAGE, html: null },
    {
      ...MESSAGE,
      get to(): never {
        throw new Error(SECRET_TEXT);
      }
    }
  ];
  for (const message of badMessages) {
    const { client, calls } = fakeClient(ok);
    await assert.rejects(
      mod.createResendReminderTransport(client).send(message as never, { idempotencyKey: KEY }),
      (error: unknown) => {
        assert.ok(error instanceof mod.ReminderTransportInputError);
        assert.equal((error as InstanceType<TransportModule["ReminderTransportInputError"]>).reason, "invalid-message");
        assert.ok(!(error as Error).message.includes("@"));
        assert.ok(!(error as Error).message.includes(KEY));
        return true;
      }
    );
    assert.equal(calls.length, 0);
  }
});

test("nietypowe, puste lub zniekształcone odpowiedzi SDK dają ambiguous", async () => {
  const responses: unknown[] = [
    undefined,
    null,
    0,
    42,
    true,
    RECEIPT,
    [],
    [{ data: { id: RECEIPT }, error: null }],
    {},
    { data: null, error: null },
    { data: {}, error: null },
    { data: [], error: null },
    { data: RECEIPT, error: null },
    { data: { id: "" }, error: null },
    { data: { id: "   " }, error: null },
    { data: { id: "\t" }, error: null },
    { data: { id: "abc\u0000def" }, error: null },
    { data: { id: "abc\u001fdef" }, error: null },
    { data: { id: "abc\u007fdef" }, error: null },
    { data: { id: "abc\ndef" }, error: null },
    { data: { id: 123 }, error: null },
    { data: { id: {} }, error: null },
    { data: { id: null }, error: null },
    { data: { id: "x".repeat(257) }, error: null },
    { data: { id: RECEIPT } },
    { data: { id: RECEIPT }, error: undefined },
    { data: { id: RECEIPT }, error: false },
    { id: RECEIPT },
    new (class Fake {
      data = { id: RECEIPT };
      error = null;
    })()
  ];
  for (const response of responses) {
    const { client, calls } = fakeClient(() => Promise.resolve(response));
    const outcome = await mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY });
    assert.deepEqual(outcome, { kind: "ambiguous" }, `response: ${JSON.stringify(response)}`);
    assert.equal(calls.length, 1);
  }
});

test("data i error jednocześnie oraz każda error response dają ambiguous, nigdy definitely-not-accepted", async () => {
  const responses: unknown[] = [
    { data: { id: RECEIPT }, error: { name: "application_error", statusCode: 500, message: "x" } },
    { data: { id: RECEIPT }, error: {} },
    { data: null, error: { name: "validation_error", statusCode: 422, message: "Invalid `to` field" } },
    { data: null, error: { name: "invalid_from_address", statusCode: 403, message: "domain not verified" } },
    { data: null, error: { name: "invalid_idempotent_request", statusCode: 409, message: "x" } },
    { data: null, error: { name: "concurrent_idempotent_requests", statusCode: 409, message: "x" } },
    { data: null, error: { name: "daily_quota_exceeded", statusCode: 429, message: "x" } },
    { data: null, error: { name: "internal_server_error", statusCode: null, message: "timeout" } },
    { data: null, error: "rejected" }
  ];
  for (const response of responses) {
    const { client } = fakeClient(() => Promise.resolve(response));
    const outcome = await mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY });
    assert.deepEqual(outcome, { kind: "ambiguous" });
    assert.notEqual(outcome.kind, "definitely-not-accepted");
  }
});

test("wyjątek SDK daje ambiguous bez przenoszenia wrażliwego tekstu i bez logowania", async () => {
  const throwers: Array<() => unknown> = [
    () => Promise.reject(new Error(SECRET_TEXT)),
    () => Promise.reject(SECRET_TEXT),
    () => {
      throw new Error(SECRET_TEXT);
    },
    () => Promise.reject(Object.assign(new Error("timeout"), { name: "TimeoutError", statusCode: 400 }))
  ];
  for (const thrower of throwers) {
    const { client, calls } = fakeClient(thrower);
    const { result, consoleCalls } = await withSilencedConsole(() =>
      mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY })
    );
    assert.deepEqual(result, { kind: "ambiguous" });
    assert.deepEqual(Object.keys(result), ["kind"]);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("re_SECRET"));
    assert.ok(!serialized.includes("postgres://"));
    assert.ok(!serialized.includes("@example.test"));
    assert.equal(consoleCalls, 0);
    assert.equal(calls.length, 1);
  }
});

test("sukces nie loguje adresów, HTML ani surowej odpowiedzi", async () => {
  const { client } = fakeClient(ok);
  const { result, consoleCalls } = await withSilencedConsole(() =>
    mod.createResendReminderTransport(client).send(MESSAGE, { idempotencyKey: KEY })
  );
  assert.deepEqual(Object.keys(result).sort(), ["kind", "receipt"]);
  assert.equal(consoleCalls, 0);
});

test("mapResendSendResponse: odpowiedź z rzucającym getterem daje ambiguous", () => {
  const hostile = {
    error: null,
    get data(): never {
      throw new Error(SECRET_TEXT);
    }
  };
  assert.deepEqual(mod.mapResendSendResponse(hostile), { kind: "ambiguous" });
  assert.deepEqual(mod.mapResendSendResponse({ data: { id: RECEIPT }, error: null, headers: {} }), {
    kind: "accepted",
    receipt: RECEIPT
  });
});

test("cały zestaw nie wykonał żadnego żądania sieciowego", () => {
  assert.equal(fetchCalls, 0);
});
