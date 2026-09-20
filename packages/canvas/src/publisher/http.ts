import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import {
  credentialSchema,
  platformSchema,
  postInput,
  type Account,
} from "./model.js";
import { addMedia, importMedia } from "./media.js";
import { Publisher } from "./service.js";
import { PublisherStore } from "./store.js";
import { OAuth } from "./oauth.js";
import { uploadR2 } from "./transport.js";
import { configureR2, wranglerStatus, uploadWithWrangler } from "./r2.js";
import { reelCatalog } from "../reels.js";
import { readPreviewAssets } from "../files.js";
import type { CanvasConfig } from "../types.js";
import { ComposioClient } from "./composio.js";

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
};
async function body(request: IncomingMessage) {
  let value = "";
  for await (const chunk of request) {
    value += chunk;
    if (Buffer.byteLength(value) > 1000000)
      throw new Error("Żądanie jest zbyt duże.");
  }
  try {
    return JSON.parse(value || "{}");
  } catch {
    throw new Error("Nieprawidłowy JSON.");
  }
}
export function publisherHttp(
  config: CanvasConfig,
  publisher = new Publisher(new PublisherStore(config.workspaceRoot)),
) {
  const oauth = new OAuth(publisher),
    store = publisher.store;
  const composioClient = () => {
    const apiKey = process.env.COMPOSIO_API_KEY?.trim();
    if (!apiKey) throw new Error("Brak COMPOSIO_API_KEY w środowisku procesu aplikacji.");
    const userId = process.env.COMPOSIO_USER_ID?.trim() || `genius-${createHash("sha256").update(path.resolve(config.workspaceRoot).toLowerCase()).digest("hex").slice(0, 16)}`;
    return new ComposioClient({apiKey, userId, baseUrl: process.env.COMPOSIO_BASE_URL});
  };
  // Attach a rejection handler immediately; requests report a damaged store without resetting it.
  void publisher.ready.catch(() => {});
  return {
    publisher,
    async handle(request: IncomingMessage, response: ServerResponse, url: URL) {
      if (!url.pathname.startsWith("/api/publisher/")) return false;
      try {
        if (!["GET", "POST"].includes(request.method || "")) {
          json(response, 405, { error: "Metoda niedozwolona." });
          return true;
        }
        if (
          request.method === "POST" &&
          request.headers["x-genius-local"] !== "1"
        ) {
          json(response, 403, {
            error: "Ta operacja wymaga lokalnej aplikacji lub CLI GENIUS@WORK.",
          });
          return true;
        }
        await publisher.ready;
        const route = url.pathname.slice("/api/publisher/".length),
          method = request.method;
        if (method === "GET" && route === "state") {
          json(response, 200, {
            ...store.state,
            workspaceId: createHash("sha256")
              .update(path.resolve(config.workspaceRoot).toLowerCase())
              .digest("hex")
              .slice(0, 16),
            assets: store.state.assets.map((a) => ({
              ...a,
              url: `/api/publisher/media/${a.id}`,
            })),
            hosting: {
              configured: publisher.hostingReady(),
              provider: "r2",
              auth: store.secrets.hosting?.r2Auth || "wrangler",
              bucket: store.secrets.hosting?.bucket || "",
              publicBaseUrl: store.secrets.hosting?.publicBaseUrl || "",
              verifiedMediaPrefix:
                store.secrets.hosting?.verifiedMediaPrefix || "",
            },
            accounts: store.state.accounts.map((a) => ({
              ...a,
              configuredFields: Object.keys(store.secrets[a.id] || {}).filter(
                (k) =>
                  Boolean(
                    store.secrets[a.id][
                      k as keyof typeof credentialSchema._output
                    ],
                  ),
              ),
            })),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            serverTime: new Date().toISOString(),
          });
        } else if (method === "GET" && route === "composio/capabilities") {
          if (!process.env.COMPOSIO_API_KEY?.trim()) {
            json(response, 200, {configured: false, capabilities: [], error: "Ustaw COMPOSIO_API_KEY w środowisku aplikacji."});
          } else {
            json(response, 200, {configured: true, capabilities: await composioClient().listPublishingCapabilities()});
          }
        } else if (method === "GET" && route === "composio/connections") {
          if (!process.env.COMPOSIO_API_KEY?.trim()) json(response, 200, {configured: false, connections: []});
          else json(response, 200, {configured: true, connections: await composioClient().listConnections()});
        } else if (method === "POST" && route === "composio/connect") {
          const input = z.object({
            authConfigId: z.string().min(1).max(200),
            alias: z.string().trim().min(1).max(100).optional(),
          }).strict().parse(await body(request));
          json(response, 200, await composioClient().createConnectLink(input));
        } else if (method === "POST" && route === "composio/execute") {
          const input = z.object({
            actionSlug: z.string().regex(/^[A-Z0-9_]+$/),
            connectedAccountId: z.string().min(1).max(200),
            arguments: z.record(z.string(), z.unknown()).default({}),
          }).strict().parse(await body(request));
          json(response, 200, await composioClient().execute(input.actionSlug, input.connectedAccountId, input.arguments));
        } else if (method === "GET" && route === "library") {
          const [reels, library] = await Promise.all([
            reelCatalog(config),
            readPreviewAssets(config.workspaceRoot),
          ]);
          json(response, 200, {
            reels: reels.reels,
            assets: library.assets
              .filter((a) => /\.(mp4|mov|jpg|jpeg|png|webp)$/i.test(a.path))
              .slice(0, 100),
          });
        } else if (method === "GET" && route.startsWith("media/")) {
          const asset = store.state.assets.find((a) => a.id === route.slice(6));
          if (!asset) {
            json(response, 404, { error: "Nie znaleziono materiału." });
            return true;
          }
          const file = path.join(store.root, "media", asset.file),
            info = await stat(file);
          let start = 0,
            end = info.size - 1,
            code = 200;
          if (request.headers.range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
            if (!match || (!match[1] && !match[2])) {
              response.writeHead(416, {
                "Content-Range": `bytes */${info.size}`,
              });
              response.end();
              return true;
            }
            start = match[1]
              ? Number(match[1])
              : Math.max(0, info.size - Number(match[2]));
            end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
            code = 206;
            if (start > end) {
              response.writeHead(416, {
                "Content-Range": `bytes */${info.size}`,
              });
              response.end();
              return true;
            }
          }
          response.writeHead(code, {
            "Content-Type": asset.mime,
            "Content-Length": end - start + 1,
            "Accept-Ranges": "bytes",
            "X-Content-Type-Options": "nosniff",
            ...(code === 206
              ? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
              : {}),
          });
          const stream = createReadStream(file, { start, end });
          stream.on("error", () => response.destroy());
          response.on("close", () => stream.destroy());
          stream.pipe(response);
        } else if (method === "POST" && route === "assets/upload") {
          const name = decodeURIComponent(
            String(request.headers["x-file-name"] || ""),
          );
          const asset = await addMedia(store, name, request);
          json(response, 201, asset);
        } else if (method === "POST" && route === "assets/import") {
          const input = z
            .object({ path: z.string().max(2000) })
            .parse(await body(request));
          json(
            response,
            201,
            await importMedia(store, config.workspaceRoot, input.path),
          );
        } else if (method === "POST" && route === "validate") {
          const input = postInput.parse(await body(request));
          json(response, 200, { issues: publisher.validate(input) });
        } else if (method === "POST" && route === "posts") {
          const { id, revision, ...input } = await body(request);
          json(response, 200, await publisher.savePost(input, id, revision));
        } else if (method === "POST" && /^posts\/[^/]+\/action$/.test(route)) {
          const input = z
            .object({
              action: z.enum(["schedule", "publish", "cancel", "retry"]),
              revision: z.number().int(),
              scheduledAt: z.string().datetime({ offset: true }).optional(),
            })
            .parse(await body(request));
          json(
            response,
            200,
            await publisher.action(
              route.split("/")[1],
              input.action,
              input.revision,
              input.scheduledAt,
            ),
          );
        } else if (method === "POST" && route === "accounts") {
          const input = z
            .object({
              id: z.string().uuid().optional(),
              platform: platformSchema,
              name: z.string().trim().min(1).max(100),
              remoteId: z
                .string()
                .regex(/^[a-zA-Z0-9_-]*$/)
                .max(200)
                .default(""),
              expiresAt: z.string().datetime({ offset: true }).optional(),
              credentials: credentialSchema,
            })
            .parse(await body(request));
          const result = await store.exclusive(async () => {
            let account = store.state.accounts.find((a) => a.id === input.id);
            if (input.id && !account) throw new Error("Konto nie istnieje.");
            if (account && account.platform !== input.platform)
              throw new Error(
                "Nie można zmienić platformy istniejącego konta.",
              );
            if (
              account?.verifiedAt &&
              input.remoteId &&
              account.remoteId !== input.remoteId
            )
              throw new Error(
                "Dodaj inne konto oddzielnie, aby nie zmienić odbiorcy zaplanowanych publikacji.",
              );
            if (!account) {
              account = {
                id: randomUUID(),
                platform: input.platform,
                name: input.name,
                remoteId: input.remoteId,
                connected: false,
              };
              store.state.accounts.push(account);
            }
            Object.assign(account, {
              name: input.name,
              remoteId: input.remoteId || account.remoteId,
              connected: false,
              expiresAt: input.expiresAt || account.expiresAt,
            });
            await store.saveSecret(account.id, input.credentials);
            await store.save();
            return account;
          });
          json(response, 200, result);
        } else if (
          method === "POST" &&
          /^accounts\/[^/]+\/(verify|creator|oauth|disconnect)$/.test(route)
        ) {
          const account = store.state.accounts.find(
            (a) => a.id === route.split("/")[1],
          );
          if (!account) throw new Error("Konto nie istnieje.");
          const action = route.split("/")[2];
          if (action === "verify") {
            try {
              await publisher.providers.verify(account);
            } catch (e) {
              account.connected = false;
              throw e;
            } finally {
              await store.exclusive(() => store.save());
            }
            json(response, 200, account);
          } else if (action === "creator") {
            const creator = await publisher.providers.creator(account);
            account.creator = creator;
            await store.exclusive(() => store.save());
            json(response, 200, creator);
          } else if (action === "oauth") {
            const input = await body(request);
            json(response, 200, {
              url: oauth.start(account, url.origin, input.direct === true),
            });
          } else {
            await store.exclusive(async () => {
              account.connected = false;
              await store.saveSecret(account.id, {
                accessToken: undefined,
                refreshToken: undefined,
              });
              await store.save();
            });
            json(response, 200, { ok: true });
          }
        } else if (method === "GET" && route === "hosting/wrangler") {
          json(response, 200, await wranglerStatus());
        } else if (method === "POST" && route === "hosting/setup") {
          const input = z
            .object({
              bucket: z.string().max(63),
              accountId: z
                .string()
                .regex(/^[a-f0-9]{32}$/)
                .optional(),
            })
            .parse(await body(request));
          const credentials = await configureR2(input.bucket, input.accountId);
          await store.exclusive(() => store.saveSecret("hosting", credentials));
          json(response, 200, {
            configured: true,
            bucket: credentials.bucket,
            publicBaseUrl: credentials.publicBaseUrl,
          });
        } else if (method === "POST" && route === "hosting") {
          const input = credentialSchema.parse(await body(request));
          await store.exclusive(() => store.saveSecret("hosting", input));
          json(response, 200, { configured: publisher.hostingReady() });
        } else if (method === "POST" && route === "hosting/verify-file") {
          const input = z
            .object({
              name: z.string().regex(/^tiktok[a-zA-Z0-9_-]+\.txt$/),
              content: z.string().min(1).max(100000),
            })
            .parse(await body(request));
          const c = store.secrets.hosting;
          if (c?.provider !== "r2")
            throw new Error(
              "Wysyłka pliku weryfikacji jest dostępna dla Cloudflare R2.",
            );
          const upload =
            c.r2Auth === "wrangler" ? uploadWithWrangler : uploadR2;
          const publicUrl = await upload(
            c,
            input.name,
            new Blob([input.content], { type: "text/plain" }),
            "text/plain",
            publisher.providers.fetcher,
          );
          json(response, 200, { url: publicUrl });
        } else if (method === "GET" && route === "oauth/callback") {
          await oauth.finish(
            url.searchParams.get("state") || "",
            url.searchParams.get("code") || "",
          );
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          });
          response.end(
            '<!doctype html><html lang="pl"><title>GENIUS@WORK — konto połączone</title><body style="font:20px system-ui;padding:8vw;background:#f8f7f3;color:#172323"><h1>Konto połączone.</h1><p>Możesz wrócić do GENIUS@WORK i zamknąć tę kartę.</p><a href="/">Wróć do studia</a></body></html>',
          );
        } else {
          json(response, 404, { error: "Nie znaleziono operacji." });
        }
      } catch (error) {
        const message =
          error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("\n")
            : error instanceof Error
              ? error.message
              : "Nie udało się wykonać operacji.";
        json(response, 400, { error: store.redact(message) });
      }
      return true;
    },
  };
}
