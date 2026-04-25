import { PICKER_URL } from '../config';

export interface PickedFile {
  fileId: string;
  fileName: string;
}

interface PickerMessage {
  type: 'requestToken' | 'filePicked' | 'pickerCancelled' | 'pickerError';
  fileId?: string;
  fileName?: string;
  error?: string;
}

export class DrivePickerBridge {
  private _token: string | null = null;
  private _pickerWindowId: number | null = null;

  async pick(token: string): Promise<PickedFile | null> {
    this._token = token;
    const listener = this._handleExternalMessage;
    chrome.runtime.onMessageExternal.addListener(listener);

    try {
      const url = `${PICKER_URL}?extId=${encodeURIComponent(chrome.runtime.id)}`;
      const win = await chrome.windows.create({
        url,
        type: 'popup',
        width: 900,
        height: 650,
      });
      this._pickerWindowId = win.id ?? null;

      return await new Promise<PickedFile | null>((resolve, reject) => {
        const onWindowRemoved = (removedId: number) => {
          if (removedId === this._pickerWindowId) {
            chrome.windows.onRemoved.removeListener(onWindowRemoved);
            resolve(null);
          }
        };
        chrome.windows.onRemoved.addListener(onWindowRemoved);

        this._resolvePick = (file) => {
          chrome.windows.onRemoved.removeListener(onWindowRemoved);
          resolve(file);
        };
        this._rejectPick = (err) => {
          chrome.windows.onRemoved.removeListener(onWindowRemoved);
          reject(err);
        };
      });
    } finally {
      chrome.runtime.onMessageExternal.removeListener(listener);
      this._token = null;
      this._pickerWindowId = null;
      this._resolvePick = null;
      this._rejectPick = null;
    }
  }

  private _resolvePick: ((file: PickedFile | null) => void) | null = null;
  private _rejectPick: ((err: Error) => void) | null = null;

  private _handleExternalMessage = (
    msg: PickerMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (msg.type === 'requestToken') {
      sendResponse({ token: this._token });
      return false;
    }
    if (msg.type === 'filePicked' && msg.fileId && msg.fileName) {
      this._resolvePick?.({ fileId: msg.fileId, fileName: msg.fileName });
      this._closePickerWindow();
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'pickerCancelled') {
      this._resolvePick?.(null);
      this._closePickerWindow();
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'pickerError') {
      this._rejectPick?.(new Error(msg.error ?? 'Unknown picker error'));
      this._closePickerWindow();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  };

  private _closePickerWindow(): void {
    if (this._pickerWindowId !== null) {
      chrome.windows.remove(this._pickerWindowId).catch(() => {});
    }
  }
}
