import { getAuthToken } from './gmail-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageStub  { id: string; threadId: string; }
export interface MessageHeader { name: string; value: string; }
export interface MessagePart  {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: MessagePart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload: {
    headers: MessageHeader[];
    mimeType: string;
    body: { data?: string; size: number };
    parts?: MessagePart[];
  };
}
export interface GmailLabel { id: string; name: string; }

// ─── Client ───────────────────────────────────────────────────────────────────

export class GmailClient {
  private static readonly _BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

  // ── API calls ──────────────────────────────────────────────────────────────

  async getProfile(): Promise<string> {
    const data = await this._fetch<{ emailAddress: string }>('/profile');
    return data.emailAddress ?? '';
  }

  async listLabels(): Promise<GmailLabel[]> {
    const data = await this._fetch<{ labels: GmailLabel[] }>('/labels');
    return data.labels ?? [];
  }

  async labelExists(name: string): Promise<boolean> {
    const labels = await this.listLabels();
    return labels.some((l) => l.name.toLowerCase() === name.toLowerCase());
  }

  async listMessages(labelName: string, maxResults = 20): Promise<MessageStub[]> {
    const params = new URLSearchParams({ q: `label:${labelName}`, maxResults: String(maxResults) });
    const data   = await this._fetch<{ messages?: MessageStub[] }>(`/messages?${params}`);
    return data.messages ?? [];
  }

  async getMessage(id: string): Promise<GmailMessage> {
    return this._fetch<GmailMessage>(`/messages/${id}?format=full`);
  }

  // ── Message decoders (pure — no auth needed) ───────────────────────────────

  static getInternalDate(message: GmailMessage): number {
    return message.internalDate ? Number(message.internalDate) : 0;
  }

  static getSubject(message: GmailMessage): string {
    return message.payload.headers.find(
      (h) => h.name.toLowerCase() === 'subject'
    )?.value ?? '(no subject)';
  }

  static getPlainTextBody(message: GmailMessage): string {
    const { payload } = message;
    const encoded = payload.mimeType === 'text/plain' && payload.body.data
      ? payload.body.data
      : payload.parts ? GmailClient._findPart(payload.parts, 'text/plain') : null;
    return encoded ? GmailClient._decodeBase64url(encoded) : '';
  }

  static getBodyForUrlExtraction(message: GmailMessage): string {
    const { payload } = message;
    const parts: string[] = [];

    const plainEncoded = payload.mimeType === 'text/plain' && payload.body.data
      ? payload.body.data
      : payload.parts ? GmailClient._findPart(payload.parts, 'text/plain') : null;
    if (plainEncoded) parts.push(GmailClient._decodeBase64url(plainEncoded));

    const htmlEncoded = payload.mimeType === 'text/html' && payload.body.data
      ? payload.body.data
      : payload.parts ? GmailClient._findPart(payload.parts, 'text/html') : null;
    if (htmlEncoded) parts.push(GmailClient._decodeBase64url(htmlEncoded));

    return parts.join('\n');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _fetch<T>(path: string): Promise<T> {
    const token = await getAuthToken();
    const res   = await fetch(`${GmailClient._BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private static _findPart(parts: MessagePart[], mimeType: string): string | null {
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body.data) return part.body.data;
      if (part.parts) {
        const found = GmailClient._findPart(part.parts, mimeType);
        if (found) return found;
      }
    }
    return null;
  }

  private static _decodeBase64url(encoded: string): string {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    try {
      return decodeURIComponent(
        atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      );
    } catch {
      return atob(base64);
    }
  }
}

export const gmailClient = new GmailClient();

// Named exports for existing callers
export const getGmailProfile       = ()                   => gmailClient.getProfile();
export const listLabels             = ()                   => gmailClient.listLabels();
export const labelExists            = (name: string)       => gmailClient.labelExists(name);
export const listMessages           = (label: string, max?: number) => gmailClient.listMessages(label, max);
export const getMessage             = (id: string)         => gmailClient.getMessage(id);
export const getInternalDate        = (m: GmailMessage)    => GmailClient.getInternalDate(m);
export const getSubject             = (m: GmailMessage)    => GmailClient.getSubject(m);
export const getPlainTextBody       = (m: GmailMessage)    => GmailClient.getPlainTextBody(m);
export const getBodyForUrlExtraction = (m: GmailMessage)   => GmailClient.getBodyForUrlExtraction(m);
