const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export async function downloadFile(fileId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive download failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return await res.arrayBuffer();
}

export async function getFileMetadata(fileId: string, token: string): Promise<{ name: string; mimeType: string }> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=name,mimeType`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive metadata failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return await res.json();
}
