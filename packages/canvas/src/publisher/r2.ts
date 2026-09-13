import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import path from "node:path";
import type { Credentials } from "./model.js";
import type { Fetch } from "./transport.js";

const execute = promisify(execFile),
  require = createRequire(import.meta.url);
export async function wranglerJson(args: string[]): Promise<any> {
  const entry = path.join(
    path.dirname(require.resolve("wrangler/package.json")),
    "bin/wrangler.js",
  );
  try {
    const { stdout } = await execute(
      process.execPath,
      [entry, ...args, "--json"],
      {
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" },
      },
    );
    return JSON.parse(stdout);
  } catch {
    // auth token output may contain secrets, including in child-process error.stdout.
    throw new Error(
      "Nie można użyć sesji Wrangler. Uruchom npx wrangler login w terminalu, a potem spróbuj ponownie.",
    );
  }
}
export async function wranglerStatus() {
  const result = await wranglerJson(["whoami"]);
  return {
    loggedIn: result.loggedIn === true,
    authType: result.authType,
    accounts: (result.accounts || []).map(
      (a: { id: string; name: string }) => ({ id: a.id, name: a.name }),
    ),
  };
}
export async function cloudflareHeaders(): Promise<Record<string, string>> {
  const credentials = await wranglerJson(["auth", "token"]);
  if (credentials.token)
    return { Authorization: `Bearer ${credentials.token}` };
  if (credentials.type === "api_key" && credentials.key && credentials.email)
    return { "X-Auth-Key": credentials.key, "X-Auth-Email": credentials.email };
  throw new Error("Brak aktywnej autoryzacji Wrangler.");
}
export async function cloudflareRequest(
  endpoint: string,
  init: RequestInit = {},
  fetcher: Fetch = fetch,
  headers?: Record<string, string>,
): Promise<any> {
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4${endpoint}`,
    {
      ...init,
      headers: {
        ...(headers || (await cloudflareHeaders())),
        ...Object.fromEntries(new Headers(init.headers)),
      },
      signal: init.signal || AbortSignal.timeout(120000),
    },
  );
  const result = (await response.json().catch(() => ({}))) as any;
  if (!response.ok || result.success === false)
    throw new Error(
      `Cloudflare R2: ${result.errors?.map((e: { message: string }) => e.message).join("; ") || `HTTP ${response.status}`}`,
    );
  return result.result;
}
export async function configureR2(bucket: string, accountId?: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
    throw new Error("Nazwa bucketu: 3–63 małe litery, cyfry lub myślniki.");
  const identity = await wranglerStatus();
  const account = accountId
    ? identity.accounts.find((a: { id: string }) => a.id === accountId)
    : identity.accounts.length === 1
      ? identity.accounts[0]
      : undefined;
  if (!account) throw new Error("Wybierz konto Cloudflare z listy.");
  const headers = await cloudflareHeaders(),
    base = `/accounts/${account.id}/r2/buckets`;
  const listing = await cloudflareRequest(base, {}, fetch, headers);
  const exists = (listing.buckets || []).some(
    (b: { name: string }) => b.name === bucket,
  );
  if (!exists)
    await cloudflareRequest(
      base,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: bucket, locationHint: "eeur" }),
      },
      fetch,
      headers,
    );
  const current = await cloudflareRequest(
    `${base}/${bucket}/domains/managed`,
    {},
    fetch,
    headers,
  );
  // Existing private buckets are never exposed as a side effect of attaching them.
  if (exists && !current.enabled)
    throw new Error(
      "Ten istniejący bucket jest prywatny. Wybierz nową nazwę bucketu przeznaczonego na publiczne media.",
    );
  const domain = current.enabled
    ? current
    : await cloudflareRequest(
        `${base}/${bucket}/domains/managed`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        },
        fetch,
        headers,
      );
  if (!domain?.domain || !domain.enabled)
    throw new Error("R2 nie zwróciło publicznego adresu mediów.");
  return {
    provider: "r2",
    r2Auth: "wrangler",
    r2AccountId: account.id,
    bucket,
    publicBaseUrl: `https://${domain.domain}`,
  } as Credentials;
}

export async function uploadWithWrangler(
  c: Credentials,
  key: string,
  blob: Blob,
  mime: string,
  fetcher: Fetch = fetch,
) {
  if (blob.size > 300 * 1024 * 1024)
    throw new Error(
      "Wysyłka R2 przez OAuth obsługuje pliki do 300 MB. Dla większych plików dodaj opcjonalne klucze S3 R2 w ustawieniach hostingu.",
    );
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  await cloudflareRequest(
    `/accounts/${c.r2AccountId}/r2/buckets/${c.bucket}/objects/${encoded}`,
    {
      method: "PUT",
      headers: { "Content-Type": mime, "Content-Length": String(blob.size) },
      body: blob,
      signal: AbortSignal.timeout(600000),
    },
    fetcher,
  );
  return `${c.publicBaseUrl!.replace(/\/$/, "")}/${encoded}`;
}
