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
  internalDate?: string; // Unix ms timestamp as string, returned by Gmail API
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

/** Returns the received date of a message from internalDate (Unix ms). */
export function getInternalDate(message: GmailMessage): Date {
  return message.internalDate ? new Date(Number(message.internalDate)) : new Date(0);
}

/** Extracts the Subject header value from a message. */
export function getSubject(message: GmailMessage): string {
  return (
    message.payload.headers.find(
      (h) => h.name.toLowerCase() === 'subject'
    )?.value ?? '(no subject)'
  );
}

/** Recursively finds the first part matching a given MIME type in a MIME tree. */
function findPart(parts: MessagePart[], mimeType: string): string | null {
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body.data) return part.body.data;
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

function decodeBase64url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
  } catch {
    return atob(base64);
  }
}

/** Decodes the plain-text body of a Gmail message (base64url → UTF-8 string). */
export function getPlainTextBody(message: GmailMessage): string {
  const { payload } = message;
  let encoded: string | null = null;

  if (payload.mimeType === 'text/plain' && payload.body.data) {
    encoded = payload.body.data;
  } else if (payload.parts) {
    encoded = findPart(payload.parts, 'text/plain');
  }

  if (!encoded) return '';
  return decodeBase64url(encoded);
}

/**
 * Returns the raw body suitable for URL extraction.
 * Prefers text/plain; falls back to text/html (e.g. HTML-only emails like LinkedIn alerts).
 * The URL extraction regex handles href="..." in HTML cleanly.
 */
export function getBodyForUrlExtraction(message: GmailMessage): string {
  const { payload } = message;

  // Try plain text first
  let encoded: string | null = null;
  if (payload.mimeType === 'text/plain' && payload.body.data) {
    encoded = payload.body.data;
  } else if (payload.parts) {
    encoded = findPart(payload.parts, 'text/plain');
  }

  // Fall back to HTML
  if (!encoded) {
    if (payload.mimeType === 'text/html' && payload.body.data) {
      encoded = payload.body.data;
    } else if (payload.parts) {
      encoded = findPart(payload.parts, 'text/html');
    }
  }

  if (!encoded) return '';
  return decodeBase64url(encoded);
}
