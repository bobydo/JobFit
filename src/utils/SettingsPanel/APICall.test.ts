import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateApiKey } from './APICall';

function parseEnvKey(filePath: string, key: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`${key}=["']?([^"'\n]+)["']?`));
  return match?.[1]?.trim() ?? '';
}

const root = process.cwd();
const realKey = parseEnvKey(resolve(root, '.env'), 'VITE_GROQ_DEFAULT_API_KEY');
const fakeKey = parseEnvKey(resolve(root, 'src/test_data/SettingsPanel/ApiKey.txt'), 'VITE_GROQ_DEFAULT_API_KEY');

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => mockFetch.mockReset());

function mockResponse(ok: boolean) {
  return Promise.resolve({ ok } as Response);
}

describe('validateApiKey', () => {
  it('groq — calls /v1/models with Bearer header and returns true on 200', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(true));
    const result = await validateApiKey('groq', 'gsk_test');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/models',
      { headers: { Authorization: 'Bearer gsk_test' } }
    );
  });

  it('groq — returns false on 401', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(false));
    expect(await validateApiKey('groq', 'bad_key')).toBe(false);
  });

  it('openai — calls /v1/models with Bearer header', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(true));
    await validateApiKey('openai', 'sk_test');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      { headers: { Authorization: 'Bearer sk_test' } }
    );
  });

  it('anthropic — calls /v1/messages with x-api-key header', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(true));
    await validateApiKey('anthropic', 'ant_test');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((opts.headers as Record<string, string>)['x-api-key']).toBe('ant_test');
    expect(opts.method).toBe('POST');
  });

  it('anthropic — returns false on 401', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(false));
    expect(await validateApiKey('anthropic', 'bad')).toBe(false);
  });

  it('throws on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    await expect(validateApiKey('groq', 'key')).rejects.toThrow('network');
  });
});

describe('validateApiKey — live integration (Groq)', () => {
  beforeAll(() => vi.unstubAllGlobals());
  afterAll(() => vi.stubGlobal('fetch', mockFetch));

  it('fake key — API rejects with false', async () => {
    const result = await validateApiKey('groq', fakeKey);
    expect(result).toBe(false);
  }, 10_000);

  it('real key — API accepts with true', async () => {
    const result = await validateApiKey('groq', realKey);
    expect(result).toBe(true);
  }, 10_000);
});
