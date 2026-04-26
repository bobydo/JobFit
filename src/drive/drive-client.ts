const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export class DriveClient {
  constructor(private readonly _token: string) {}

  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this._token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Drive download failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return res.arrayBuffer();
  }

  async getFileMetadata(fileId: string): Promise<{ name: string; mimeType: string }> {
    const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=name,mimeType`, {
      headers: { Authorization: `Bearer ${this._token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Drive metadata failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return res.json();
  }
}
