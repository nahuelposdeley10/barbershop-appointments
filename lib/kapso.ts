import "server-only";

const DEFAULT_BASE_URL = "https://api.kapso.ai";

type KapsoResponse<T> = { data?: T; error?: { message?: string } | string };

function kapsoApiKey() {
  return process.env.KAPSO_API_KEY?.trim() || "";
}

function kapsoBaseUrl() {
  return (process.env.KAPSO_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function isKapsoConfigured() {
  return Boolean(kapsoApiKey());
}

function errorMessage(payload: KapsoResponse<unknown>, status: number) {
  if (typeof payload.error === "string") return payload.error.slice(0, 300);
  if (payload.error?.message) return payload.error.message.slice(0, 300);
  return `Kapso respondió con estado ${status}`;
}

async function kapsoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = kapsoApiKey();
  if (!apiKey) throw new Error("La integración de Kapso todavía no está configurada en el servidor");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${kapsoBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as KapsoResponse<T>;
    if (!response.ok) throw new Error(errorMessage(payload, response.status));
    return (payload.data ?? payload) as T;
  } finally {
    clearTimeout(timeout);
  }
}

type Customer = { id?: string; external_customer_id?: string };
type SetupLink = { id?: string; url?: string; status?: string; whatsapp_setup_status?: string };
type PhoneNumber = {
  id?: string;
  phone_number_id?: string;
  business_account_id?: string;
  customer_id?: string;
  display_phone_number?: string;
  status?: string;
};
type Template = { name?: string; language?: string; status?: string; category?: string };

function unwrap<T extends object>(value: T | { data?: T }) {
  if (value && typeof value === "object" && "data" in value && value.data) return value.data as T;
  return value as T;
}

export async function kapsoCreateCustomer(name: string, externalCustomerId: string) {
  const result = await kapsoRequest<Customer>("/platform/v1/customers", {
    method: "POST",
    body: JSON.stringify({ customer: { name, external_customer_id: externalCustomerId } }),
  });
  const customer = unwrap(result);
  if (!customer.id) throw new Error("Kapso no devolvió el identificador del cliente");
  return customer;
}

export async function kapsoCreateSetupLink(customerId: string) {
  const result = await kapsoRequest<SetupLink>(
    `/platform/v1/customers/${encodeURIComponent(customerId)}/setup_links`,
    { method: "POST", body: JSON.stringify({ setup_link: {} }) }
  );
  const setup = unwrap(result);
  if (!setup.url) throw new Error("Kapso no devolvió el enlace de conexión");
  return setup;
}

export async function kapsoListPhoneNumbers(customerId: string) {
  const result = await kapsoRequest<PhoneNumber[] | { phone_numbers?: PhoneNumber[] }>(
    `/platform/v1/whatsapp/phone_numbers?customer_id=${encodeURIComponent(customerId)}`
  );
  const unwrapped = unwrap(result);
  return Array.isArray(unwrapped) ? unwrapped : unwrapped.phone_numbers || [];
}

export async function kapsoListTemplates(businessAccountId: string) {
  const result = await kapsoRequest<Template[] | { templates?: Template[] }>(
    `/meta/whatsapp/v24.0/${encodeURIComponent(businessAccountId)}/message_templates`
  );
  const unwrapped = unwrap(result);
  return Array.isArray(unwrapped) ? unwrapped : unwrapped.templates || [];
}

export async function kapsoSendReminder(args: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
  callbackData: string;
}) {
  const components = args.parameters.length
    ? [{ type: "body", parameters: args.parameters.map((text) => ({ type: "text", text })) }]
    : undefined;
  const result = await kapsoRequest<{ messages?: { id?: string }[] }>(
    `/meta/whatsapp/v24.0/${encodeURIComponent(args.phoneNumberId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: args.to,
        type: "template",
        template: {
          name: args.templateName,
          language: { code: args.languageCode },
          ...(components ? { components } : {}),
        },
        biz_opaque_callback_data: args.callbackData,
      }),
    }
  );
  return { messageId: result.messages?.[0]?.id || "" };
}
