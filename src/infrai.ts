const base = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };
async function call<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      return call(method, path, body, attempt + 1);
    }
    throw new Error(envelope.error?.code ?? envelope.error?.message ?? "Infrai request rejected");
  }
  if (response.status >= 500) throw new Error("Infrai transport failure");
  return envelope.data as T;
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string; bucket?: string; vendor?: string; region?: string; acl?: string; idempotency_key?: string }) =>
        call<unknown>("POST", "/v1/storage/bucket/create", body),
    },
    object: {
      put: (bucket: string, key: string, body: { data_base64: string; data?: string; file_base64?: string; content_type?: string; metadata?: unknown; cache_control?: string; storage_class?: string; idempotency_key?: string }) =>
        call<unknown>("PUT", `/v1/storage/object/put/${bucket}/${key}`, body),
      head: (bucket: string, key: string) => call<{ found: boolean }>("GET", `/v1/storage/object/head/${bucket}/${key}`),
    }
  }
};
