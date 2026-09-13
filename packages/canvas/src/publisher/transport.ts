import { open } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import path from "node:path";
import type { Asset, Credentials } from "./model.js";
import type { PublisherStore } from "./store.js";
import { AwsClient } from "aws4fetch";
import { uploadWithWrangler } from "./r2.js";

export type Fetch = typeof fetch;
export class ApiError extends Error {
  constructor(
    message: string,
    public uncertain = false,
  ) {
    super(message);
  }
}
export async function requestJson(
  url: string,
  init: RequestInit = {},
  fetcher: Fetch = fetch,
): Promise<any> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(120000),
    });
  } catch {
    throw new ApiError(
      "Brak odpowiedzi platformy. Sprawdź połączenie i wynik na koncie.",
      init.method === "POST",
    );
  }
  const body = (await response.json().catch(() => ({}))) as any;
  if (!response.ok || (body.error && body.error.code !== "ok")) {
    const error = body.error;
    throw new ApiError(
      `${response.status}: ${error?.message || error?.error_user_msg || error?.code || body.error_description || "Platforma odrzuciła żądanie."}`,
      response.status >= 500 && init.method === "POST",
    );
  }
  return body;
}
export const form = (values: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [
        k,
        typeof v === "object" ? JSON.stringify(v) : String(v),
      ]),
  );
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function uploadChunks(
  url: string,
  file: string,
  bytes: number,
  mime: string,
  chunkSize: number,
  fetcher: Fetch,
  headers: Record<string, string> = {},
) {
  const handle = await open(file, "r");
  let result: any;
  try {
    // TikTok allows a larger last chunk: use floor(size/chunkSize), not ceil.
    const count = Math.max(1, Math.floor(bytes / chunkSize));
    for (let index = 0; index < count; index++) {
      const start = index * chunkSize,
        end = index === count - 1 ? bytes : start + chunkSize;
      const buffer = Buffer.alloc(end - start);
      let offset = 0;
      while (offset < buffer.length) {
        const read = await handle.read(
          buffer,
          offset,
          buffer.length - offset,
          start + offset,
        );
        if (!read.bytesRead)
          throw new Error("Plik został skrócony podczas wysyłki.");
        offset += read.bytesRead;
      }
      let response: Response;
      try {
        response = await fetcher(url, {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": mime,
            "Content-Length": String(buffer.length),
            "Content-Range": `bytes ${start}-${end - 1}/${bytes}`,
          },
          body: buffer,
          signal: AbortSignal.timeout(180000),
        });
      } catch {
        throw new ApiError(
          "Utracono połączenie podczas przesyłania filmu.",
          true,
        );
      }
      if (!response.ok && response.status !== 308)
        throw new ApiError(
          `Wysyłka filmu: HTTP ${response.status}.`,
          response.status >= 500,
        );
      if (response.ok) result = await response.json().catch(() => ({}));
    }
  } finally {
    await handle.close();
  }
  return result;
}

export async function publicMedia(
  store: PublisherStore,
  asset: Asset,
  fetcher: Fetch,
): Promise<string> {
  if (asset.publicUrl) return asset.publicUrl;
  const c = store.secrets.hosting;
  if (!c?.r2AccountId || !c.bucket || !c.publicBaseUrl)
    throw new Error("Skonfiguruj Cloudflare R2 w sekcji Konta i klucze.");
  const blob = await openAsBlob(path.join(store.root, "media", asset.file), {
    type: asset.mime,
  });
  const key = `genius-work/${asset.file}`;
  const url =
    c.r2Auth === "wrangler"
      ? await uploadWithWrangler(c, key, blob, asset.mime, fetcher)
      : await uploadR2(c, key, blob, asset.mime, fetcher);
  await store.exclusive(async () => {
    asset.publicUrl = url;
    await store.save();
  });
  return url;
}

export async function uploadR2(
  c: Credentials,
  key: string,
  blob: Blob,
  mime: string,
  fetcher: Fetch = fetch,
) {
  if (
    !c.r2AccountId ||
    !c.bucket ||
    !c.accessKeyId ||
    !c.secretAccessKey ||
    !c.publicBaseUrl
  )
    throw new Error("Uzupełnij dane Cloudflare R2 w hostingu mediów.");
  const client = new AwsClient({
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  const signed = await client.sign(
    `https://${c.r2AccountId}.r2.cloudflarestorage.com/${c.bucket}/${encoded}?X-Amz-Expires=900`,
    {
      method: "PUT",
      headers: { "Content-Type": mime },
      aws: { signQuery: true },
    },
  );
  const response = await fetcher(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: blob,
    signal: AbortSignal.timeout(600000),
  });
  if (!response.ok)
    throw new Error(
      `Cloudflare R2: HTTP ${response.status}. Sprawdź klucze, uprawnienia i nazwę bucketu.`,
    );
  return `${c.publicBaseUrl.replace(/\/$/, "")}/${encoded}`;
}

export async function freshToken(
  store: PublisherStore,
  id: string,
  fetcher: Fetch,
): Promise<string> {
  const account = store.state.accounts.find((a) => a.id === id)!;
  const c = store.secrets[id] ?? {};
  const expiry = account.expiresAt ? Date.parse(account.expiresAt) : Infinity;
  if (c.accessToken && expiry > Date.now() + 300000) return c.accessToken;
  let result: any;
  if (
    account.platform === "youtube" &&
    c.refreshToken &&
    c.clientId &&
    c.clientSecret
  ) {
    result = await requestJson(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        body: form({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          refresh_token: c.refreshToken,
          grant_type: "refresh_token",
        }),
      },
      fetcher,
    );
  } else if (
    account.platform === "tiktok" &&
    c.refreshToken &&
    c.clientId &&
    c.clientSecret
  ) {
    result = await requestJson(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        body: form({
          client_key: c.clientId,
          client_secret: c.clientSecret,
          refresh_token: c.refreshToken,
          grant_type: "refresh_token",
        }),
      },
      fetcher,
    );
  } else if (
    account.platform === "threads" &&
    c.accessToken &&
    expiry > Date.now()
  ) {
    result = await requestJson(
      `https://graph.threads.net/refresh_access_token?${form({ grant_type: "th_refresh_token", access_token: c.accessToken })}`,
      {},
      fetcher,
    );
  } else
    throw new Error(
      "Token wygasł lub go brakuje. Połącz ponownie konto w ustawieniach.",
    );
  if (!result.access_token)
    throw new Error("Platforma nie zwróciła tokenu. Połącz konto ponownie.");
  await store.exclusive(async () => {
    await store.saveSecret(id, {
      accessToken: result.access_token,
      refreshToken: result.refresh_token || c.refreshToken,
    });
    account.expiresAt = new Date(
      Date.now() + (result.expires_in || 3600) * 1000,
    ).toISOString();
    await store.save();
  });
  return result.access_token;
}
