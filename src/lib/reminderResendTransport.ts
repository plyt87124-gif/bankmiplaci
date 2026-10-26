/**
 * Samodzielny adapter odpowiedzi Resend dla wysyłki przypomnień.
 *
 * - Klient SDK jest wstrzykiwany; moduł nie importuje SDK, nie czyta konfiguracji
 *   środowiska i nic nie wysyła przy imporcie.
 * - Brak ponowień i obsługi timeoutu: nadzoruje je zewnętrzny dispatcher.
 * - "accepted" oznacza wyłącznie przyjęcie przez API, nie dostarczenie ani przeczytanie.
 * - Ta wersja nigdy nie zwraca "definitely-not-accepted": każda odpowiedź inna niż
 *   zweryfikowany sukces (w tym error response i wyjątek) jest "ambiguous".
 */

export interface ReminderMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

export interface ReminderSendOptions {
  readonly idempotencyKey: string;
}

export interface ReminderTransport {
  send(message: Readonly<ReminderMessage>, options: ReminderSendOptions): Promise<unknown>;
}

export type ProviderOutcome =
  | { kind: "accepted"; receipt: string }
  | { kind: "definitely-not-accepted" }
  | { kind: "ambiguous" };

export interface ResendReminderTransport extends ReminderTransport {
  send(message: Readonly<ReminderMessage>, options: ReminderSendOptions): Promise<ProviderOutcome>;
}

export interface ResendSendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

/** Minimalny strukturalny kształt klienta Resend (`resend.emails.send(payload, { idempotencyKey })`). */
export interface ResendEmailsClientLike {
  readonly emails: {
    send(payload: ResendSendPayload, options: { idempotencyKey: string }): Promise<unknown>;
  };
}

export class ReminderTransportConfigError extends Error {
  constructor() {
    super("Reminder transport: invalid provider client.");
    this.name = "ReminderTransportConfigError";
  }
}

export type ReminderTransportInputReason = "invalid-idempotency-key" | "invalid-message";

export class ReminderTransportInputError extends Error {
  readonly reason: ReminderTransportInputReason;

  constructor(reason: ReminderTransportInputReason) {
    super(`Reminder transport: ${reason}.`);
    this.name = "ReminderTransportInputError";
    this.reason = reason;
  }
}

const IDEMPOTENCY_KEY_PATTERN = /^bmp-task-v1\/[0-9a-f]{64}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const MAX_RECEIPT_LENGTH = 256;

function ambiguous(): ProviderOutcome {
  return Object.freeze({ kind: "ambiguous" as const });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isSafeReceipt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_RECEIPT_LENGTH &&
    value.trim().length > 0 &&
    !CONTROL_CHARS.test(value)
  );
}

function readIdempotencyKey(options: unknown): string | null {
  try {
    if (typeof options !== "object" || options === null) return null;
    const key: unknown = (options as { idempotencyKey?: unknown }).idempotencyKey;
    return typeof key === "string" && IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
  } catch {
    return null;
  }
}

function readHeaderField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 && !CONTROL_CHARS.test(value) ? value : null;
}

/** Odczytuje każde pole dokładnie raz i buduje świeży payload; wejście nie jest modyfikowane. */
function readPayload(message: unknown): ResendSendPayload | null {
  try {
    if (typeof message !== "object" || message === null) return null;
    const source = message as Record<string, unknown>;
    const from = readHeaderField(source.from);
    const to = readHeaderField(source.to);
    const subject = readHeaderField(source.subject);
    const html: unknown = source.html;
    if (from === null || to === null || subject === null) return null;
    if (typeof html !== "string" || html.trim().length === 0) return null;
    return { from, to, subject, html };
  } catch {
    return null;
  }
}

/**
 * Mapuje wynik `emails.send`. Jedynie `{ data: { id }, error: null }` z bezpiecznym id daje
 * "accepted"; wszystko inne (także error response z dowolnym statusem/nazwą) to "ambiguous".
 */
export function mapResendSendResponse(response: unknown): ProviderOutcome {
  try {
    if (!isPlainRecord(response)) return ambiguous();
    if (!Object.prototype.hasOwnProperty.call(response, "error") || response.error !== null) return ambiguous();
    const data = response.data;
    if (!isPlainRecord(data)) return ambiguous();
    const id = data.id;
    if (!isSafeReceipt(id)) return ambiguous();
    return Object.freeze({ kind: "accepted" as const, receipt: id });
  } catch {
    return ambiguous();
  }
}

export function createResendReminderTransport(client: ResendEmailsClientLike): ResendReminderTransport {
  let emails: ResendEmailsClientLike["emails"];
  let sendFn: ResendEmailsClientLike["emails"]["send"];
  try {
    if (typeof client !== "object" || client === null) throw new ReminderTransportConfigError();
    emails = client.emails;
    if ((typeof emails !== "object" && typeof emails !== "function") || emails === null) {
      throw new ReminderTransportConfigError();
    }
    sendFn = emails.send;
    if (typeof sendFn !== "function") throw new ReminderTransportConfigError();
  } catch {
    throw new ReminderTransportConfigError();
  }

  return Object.freeze({
    async send(message: Readonly<ReminderMessage>, options: ReminderSendOptions): Promise<ProviderOutcome> {
      const idempotencyKey = readIdempotencyKey(options);
      if (idempotencyKey === null) throw new ReminderTransportInputError("invalid-idempotency-key");
      const payload = readPayload(message);
      if (payload === null) throw new ReminderTransportInputError("invalid-message");

      let response: unknown;
      try {
        response = await sendFn.call(emails, payload, { idempotencyKey });
      } catch {
        return ambiguous();
      }
      return mapResendSendResponse(response);
    }
  });
}
