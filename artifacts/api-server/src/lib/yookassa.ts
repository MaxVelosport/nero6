/**
 * Клиент ЮKassa REST API
 * https://yookassa.ru/developers/api
 */

const YK_API_URL = "https://api.yookassa.ru/v3";

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error("YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не настроены");
  }
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export function isYookassaConfigured(): boolean {
  return !!(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

export interface YookassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
  description?: string;
}

export interface CreatePaymentParams {
  amount: number;
  description: string;
  returnUrl: string;
  userId: number;
  packageKey: string;
  userEmail: string;
}

export async function createPayment(params: CreatePaymentParams): Promise<YookassaPayment> {
  const idempotenceKey = `${params.userId}-${params.packageKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    amount: {
      value: params.amount.toFixed(2),
      currency: "RUB",
    },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    description: params.description,
    metadata: {
      user_id: String(params.userId),
      package_key: params.packageKey,
    },
    receipt: {
      customer: { email: params.userEmail },
      items: [
        {
          description: params.description.slice(0, 128),
          quantity: "1.00",
          amount: { value: params.amount.toFixed(2), currency: "RUB" },
          vat_code: 1,
          payment_subject: "service",
          payment_mode: "full_payment",
        },
      ],
    },
  };

  const resp = await fetch(`${YK_API_URL}/payments`, {
    method: "POST",
    headers: {
      "Authorization": authHeader(),
      "Idempotence-Key": idempotenceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await resp.json()) as YookassaPayment & { description?: string; code?: string };
  if (!resp.ok) {
    throw new Error(`ЮKassa API error: ${data.description || data.code || resp.statusText}`);
  }
  return data;
}

export async function getPayment(paymentId: string): Promise<YookassaPayment> {
  const resp = await fetch(`${YK_API_URL}/payments/${paymentId}`, {
    headers: { "Authorization": authHeader() },
  });
  const data = (await resp.json()) as YookassaPayment & { description?: string; code?: string };
  if (!resp.ok) {
    throw new Error(`ЮKassa API error: ${data.description || data.code || resp.statusText}`);
  }
  return data;
}
