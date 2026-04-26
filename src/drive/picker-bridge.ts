import { PICKER_URL } from '../config';

export interface PickedFile {
  fileId: string;
  fileName: string;
}

interface PickerMessage {
  type: 'requestToken' | 'filesPicked' | 'pickerCancelled' | 'pickerError';
  files?: Array<{ fileId: string; fileName: string }>;
  error?: string;
}

export class DrivePickerBridge {
  private _token: string | null = null;
  private _pickerWindowId: number | null = null;
  private _resolvePick: ((files: PickedFile[] | null) => void) | null = null;
  private _rejectPick: ((err: Error) => void) | null = null;

  async pick(token: string): Promise<PickedFile[] | null> {
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

      return await new Promise<PickedFile[] | null>((resolve, reject) => {
        const onWindowRemoved = (removedId: number) => {
          if (removedId === this._pickerWindowId) {
            chrome.windows.onRemoved.removeListener(onWindowRemoved);
            resolve(null);
          }
        };
        chrome.windows.onRemoved.addListener(onWindowRemoved);

        this._resolvePick = (files) => {
          chrome.windows.onRemoved.removeListener(onWindowRemoved);
          resolve(files);
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

  private _handleExternalMessage = (
    msg: PickerMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (msg.type === 'requestToken') {
      sendResponse({ token: this._token });
      return false;
    }
    if (msg.type === 'filesPicked' && msg.files?.length) {
      this._resolvePick?.(msg.files as PickedFile[]);
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
