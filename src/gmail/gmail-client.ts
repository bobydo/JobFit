import { getAuthToken } from './gmail-auth';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageStub {
  id: string;
  threadId: string;
}

export interface MessageHeader {
  name: string;
  value: string;
}

export interface MessagePart {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: MessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: MessageHeader[];
    mimeType: string;
    body: { data?: string; size: number };
    parts?: MessagePart[];
  };
}

export interface GmailLabel {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function gmailFetch<T>(path: string): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ─── Label API ────────────────────────────────────────────────────────────────

/** Returns all labels in the mailbox. Used for onboarding label existence check. */
export async function listLabels(): Promise<GmailLabel[]> {
  const data = await gmailFetch<{ labels: GmailLabel[] }>('/labels');
  return data.labels ?? [];
}

/** Returns true if a label with the given name exists (case-insensitive). */
export async function labelExists(name: string): Promise<boolean> {
  const labels = await listLabels();
  return labels.some((l) => l.name.toLowerCase() === name.toLowerCase());
}

// ─── Message API ──────────────────────────────────────────────────────────────

/**
 * Lists messages with the given label filter.
 * All queries are label-scoped — the extension never reads inbox at large.
 */
export async function listMessages(
  labelName: string,
  maxResults = 20
): Promise<MessageStub[]> {
  const params = new URLSearchParams({
    q: `label:${labelName}`,
    maxResults: String(maxResults),
  });
  const data = await gmailFetch<{ messages?: MessageStub[] }>(
    `/messages?${params}`
  );
  return data.messages ?? [];
}

/** Fetches full message by ID. */
export async function getMessage(id: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(`/messages/${id}?format=full`);
}

/** Extracts the Subject header value from a message. */
export function getSubject(message: GmailMessage): string {
  return (
    message.payload.headers.find(
      (h) => h.name.toLowerCase() === 'subject'
    )?.value ?? '(no subject)'
  );
}
