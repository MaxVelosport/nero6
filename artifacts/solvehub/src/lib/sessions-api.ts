const BASE = "/api/sessions";

function getToken() {
  return localStorage.getItem("authToken");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export interface SessionPackage {
  name: string;
  description: string;
  questions: number;
  price: number;
  pricePerQuestion: number;
  durationHours: number | null;
  icon: string;
  color: string;
  features: string[];
  bestFor: string;
  recommended?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  badge: string;
  description: string;
  contextWindow: string;
  priceMultiplier: number;
  supportsImages: boolean;
  supportsFiles: boolean;
  recommended: boolean;
  color: string;
  strengths: string[];
}

export interface SessionMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  question_number: number | null;
  processing_time_ms: number | null;
  created_at: string;
  attachment_data?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
}

export interface Session {
  id: number;
  user_id: number;
  title: string;
  subject: string;
  purpose: string;
  package_type: string;
  model_id: string;
  questions_total: number;
  questions_used: number;
  total_cost: number;
  status: "active" | "completed" | "expired" | "paused";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  messages_count?: number;
  package?: SessionPackage;
  messages?: SessionMessage[];
}

export interface SendMessageResult {
  userMessage: SessionMessage;
  assistantMessage: SessionMessage;
  questionsUsed: number;
  questionsTotal: number;
  questionsRemaining: number | null;
  sessionCompleted: boolean;
  attachmentExtraCost?: number;
}

export async function getPackages(): Promise<Record<string, SessionPackage>> {
  const res = await fetch(`${BASE}/packages`);
  return res.json();
}

export async function getModels(): Promise<Record<string, AIModel>> {
  const res = await fetch(`${BASE}/models`);
  return res.json();
}

export async function listSessions(): Promise<{ sessions: Session[]; total: number }> {
  const res = await fetch(`${BASE}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Ошибка загрузки сессий");
  return res.json();
}

export async function createSession(data: {
  title: string;
  subject: string;
  purpose: string;
  packageType: string;
  modelId?: string;
}): Promise<Session> {
  const res = await fetch(`${BASE}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw { status: res.status, ...json };
  return json;
}

export async function getSession(id: number): Promise<Session> {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Сессия не найдена");
  return res.json();
}

export async function sendMessage(
  sessionId: number,
  content: string,
  attachment?: { data: string; name: string; type: string; sizeBytes?: number } | null
): Promise<SendMessageResult> {
  const res = await fetch(`${BASE}/${sessionId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      content,
      attachmentData: attachment?.data || null,
      attachmentName: attachment?.name || null,
      attachmentType: attachment?.type || null,
      attachmentSizeBytes: attachment?.sizeBytes || null,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function updateSessionStatus(
  sessionId: number,
  status: "completed" | "paused"
): Promise<Session> {
  const res = await fetch(`${BASE}/${sessionId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}
