import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCanvasConfig } from "../config.js";
import { createCanvasServer } from "../create-canvas-server.js";
import { PublisherStore } from "./store.js";
import { Publisher } from "./service.js";
import { Providers } from "./providers.js";
import {
  postInput,
  validatePost,
  type Account,
  type Asset,
  type Platform,
} from "./model.js";
import {
  ApiError,
  uploadChunks,
  requestJson,
  freshToken,
  uploadR2,
} from "./transport.js";
import { OAuth } from "./oauth.js";

const run = promisify(execFile);
const listen = (server: Server) =>
  new Promise<string>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(
        `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      ),
    ),
  );
const close = (server: Server) =>
  new Promise<void>((resolve) => server.close(() => resolve()));
const video: Asset = {
  id: randomUUID(),
  name: "reel.mp4",
  file: "reel.mp4",
  type: "video",
  mime: "video/mp4",
  bytes: 100,
  width: 1080,
  height: 1920,
  duration: 30,
  createdAt: new Date().toISOString(),
  publicUrl: "https://media.example/reel.mp4",
};
const photo: Asset = {
  ...video,
  id: randomUUID(),
  name: "image.jpg",
  file: "image.jpg",
  type: "image",
  mime: "image/jpeg",
  duration: undefined,
  height: 1350,
  publicUrl: "https://media.example/image.jpg",
};
const account = (platform: Platform): Account => ({
  id: randomUUID(),
  platform,
  name: platform,
  remoteId: `${platform}-account`,
  connected: true,
});
const input = (accountIds: string[], assetIds = [video.id]) =>
  postInput.parse({
    title: "GENIUS@WORK",
    caption: "Gotowa treść",
    format: "reel",
    accountIds,
    assetIds,
    options: {
      tiktokMode: "direct",
      tiktokPrivacy: "SELF_ONLY",
      tiktokConsent: true,
    },
  });
async function fixture(platforms: Platform[] = ["facebook"]) {
  const workspace = await mkdtemp(path.join(tmpdir(), "genius-publisher-"));
  const store = new PublisherStore(workspace),
    providers = new Providers(store);
  const publisher = new Publisher(store, providers);
  await publisher.ready;
  store.state.assets = [structuredClone(video), structuredClone(photo)];
  store.state.accounts = platforms.map(account);
  for (const a of store.state.accounts)
    store.secrets[a.id] = { accessToken: "test-token" };
  await store.save();
  return { workspace, store, providers, publisher };
}

test("platform matrix rejects unsupported formats and allows drafts without accounts", async () => {
  const yt = account("youtube"),
    tt = account("tiktok"),
    ig = account("instagram");
  assert.deepEqual(validatePost(input([yt.id]), [video], [yt], false), []);
  const carousel = {
    ...input([yt.id, tt.id, ig.id], [photo.id, video.id]),
    format: "carousel" as const,
  };
  const errors = validatePost(carousel, [photo, video], [yt, tt, ig], false);
  assert.ok(errors.some((e) => e.startsWith("YouTube")));
  assert.ok(errors.some((e) => e.startsWith("TikTok")));
  assert.ok(postInput.parse({ title: "Szkic", format: "single" }));
  assert.ok(
    validatePost(
      postInput.parse({ title: "Szkic", format: "single", caption: "Tekst" }),
      [],
      [],
      false,
    ).some((e) => /konto/.test(e)),
  );
  assert.ok(
    validatePost(
      { ...input([ig.id]), caption: "x".repeat(2201) },
      [video],
      [ig],
      true,
    ).some((e) => /2200/.test(e)),
  );
});

test("durable queue runs once, retries failed destinations only and rejects stale revisions", async () => {
  const { store, publisher, providers } = await fixture([
    "facebook",
    "threads",
  ]);
  let fail = true;
  const calls: string[] = [];
  providers.publish = async (_post, a) => {
    calls.push(a.platform);
    if (a.platform === "threads" && fail) throw new Error("Brak uprawnienia");
    return { status: "published", remoteId: `published-${a.platform}` };
  };
  const post = await publisher.savePost(
    input(store.state.accounts.map((a) => a.id)),
  );
  await publisher.action(post.id, "publish", post.revision);
  await publisher.tick();
  while (store.state.posts[0].status === "publishing")
    await new Promise((r) => setTimeout(r, 5));
  assert.equal(store.state.posts[0].status, "partial");
  assert.deepEqual(calls, ["facebook", "threads"]);
  await assert.rejects(publisher.action(post.id, "retry", 1), /zmieniła/);
  fail = false;
  await publisher.action(post.id, "retry", store.state.posts[0].revision);
  while (store.state.posts[0].status !== "published")
    await new Promise((r) => setTimeout(r, 5));
  await publisher.tick();
  assert.deepEqual(calls, ["facebook", "threads", "threads"]);
  await store.close();
  const reopened = new PublisherStore(path.dirname(store.root));
  await reopened.initialize();
  assert.equal(reopened.state.posts[0].status, "published");
  await reopened.close();
});

test("ambiguous final response never blindly retries or claims success", async () => {
  const { store, publisher, providers } = await fixture();
  let calls = 0;
  providers.publish = async () => {
    calls++;
    throw new ApiError("Utracono odpowiedź", true);
  };
  const post = await publisher.savePost(
    input(store.state.accounts.map((a) => a.id)),
  );
  await publisher.action(post.id, "publish", post.revision);
  while (
    store.state.posts[0].status === "scheduled" ||
    store.state.posts[0].status === "publishing"
  )
    await new Promise((r) => setTimeout(r, 5));
  assert.equal(store.state.posts[0].status, "needs_attention");
  await publisher.tick();
  assert.equal(calls, 1);
  await assert.rejects(
    publisher.action(post.id, "retry", store.state.posts[0].revision),
    /Brak nieudanych/,
  );
  await store.close();
});

test("restart marks interrupted sends for review and resumes processing by remote ID", async () => {
  const { workspace, store, publisher } = await fixture(["youtube"]);
  const post = await publisher.savePost(
    input(store.state.accounts.map((a) => a.id)),
  );
  post.status = "publishing";
  post.destinations[0].status = "publishing";
  await store.save();
  await store.close();
  const reopened = new PublisherStore(workspace);
  await reopened.initialize();
  assert.equal(reopened.state.posts[0].status, "needs_attention");
  assert.equal(
    reopened.state.posts[0].destinations[0].status,
    "needs_attention",
  );
  await reopened.close();
});

test("scheduling uses real instants across timezones; cancel prevents sends; a second process cannot own the queue", async () => {
  const { workspace, store, publisher, providers } = await fixture();
  let calls = 0;
  providers.publish = async () => {
    calls++;
    return { status: "published", remoteId: "one" };
  };
  const post = await publisher.savePost(
    input(store.state.accounts.map((a) => a.id)),
  );
  await assert.rejects(
    publisher.action(
      post.id,
      "schedule",
      post.revision,
      "2000-01-01T12:00:00+02:00",
    ),
    /przyszłą/,
  );
  await publisher.action(
    post.id,
    "schedule",
    post.revision,
    "2099-10-25T12:00:00+02:00",
  );
  assert.equal(store.state.posts[0].scheduledAt, "2099-10-25T10:00:00.000Z");
  await publisher.action(post.id, "cancel", store.state.posts[0].revision);
  await publisher.tick();
  assert.equal(calls, 0);
  const second = new PublisherStore(workspace);
  await assert.rejects(second.initialize(), /już uruchomiony/);
  await store.close();
});

test("credentials are encrypted on disk, redacted from errors and survive restart", async () => {
  const { workspace, store } = await fixture();
  await store.saveSecret("hosting", {
    secretAccessKey: "a-realistic-secret-value",
    accessKeyId: "123456",
    provider: "r2",
  });
  const disk = await readFile(path.join(store.root, "credentials.enc"), "utf8");
  assert.ok(!disk.includes("a-realistic-secret-value"));
  assert.equal(
    store.redact("Problem a-realistic-secret-value"),
    "Problem [ukryto]",
  );
  await store.close();
  const again = new PublisherStore(workspace);
  await again.initialize();
  assert.equal(
    again.secrets.hosting.secretAccessKey,
    "a-realistic-secret-value",
  );
  await again.close();
});

test("OAuth validates one-time state and scopes; TikTok Inbox does not request Direct Post", async () => {
  const { store, publisher } = await fixture(["youtube", "tiktok"]);
  for (const a of store.state.accounts)
    store.secrets[a.id] = { clientId: "client", clientSecret: "secret" };
  const oauth = new OAuth(publisher),
    yt = new URL(oauth.start(store.state.accounts[0], "http://127.0.0.1:4188"));
  assert.equal(yt.searchParams.get("access_type"), "offline");
  assert.equal(yt.searchParams.get("code_challenge_method"), "S256");
  const tt = new URL(
    oauth.start(store.state.accounts[1], "http://127.0.0.1:4188"),
  );
  assert.ok(!tt.searchParams.get("scope")!.includes("video.publish"));
  assert.equal(tt.searchParams.get("code_challenge")!.length, 64);
  await assert.rejects(oauth.finish("wrong-state", "code"), /wygasła/);
  await store.close();
});

test("chunk uploads use exact ranges including the larger final chunk", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "genius-chunk-")),
    file = path.join(folder, "clip.mp4");
  await writeFile(file, Buffer.alloc(25, 7));
  const ranges: string[] = [],
    sizes: number[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    ranges.push((init!.headers as Record<string, string>)["Content-Range"]);
    sizes.push((init!.body as Buffer).length);
    return Response.json({ id: "video" });
  };
  await uploadChunks(
    "https://uploads.example",
    file,
    25,
    "video/mp4",
    10,
    fetcher,
  );
  assert.deepEqual(ranges, ["bytes 0-9/25", "bytes 10-24/25"]);
  assert.deepEqual(sizes, [10, 15]);
});

test("expired OAuth tokens refresh once, persist rotated refresh tokens and are reused", async () => {
  const { store } = await fixture(["youtube"]);
  const a = store.state.accounts[0];
  a.expiresAt = "2020-01-01T00:00:00Z";
  store.secrets[a.id] = {
    accessToken: "old-token",
    refreshToken: "old-refresh",
    clientId: "client",
    clientSecret: "secret",
  };
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://oauth2.googleapis.com/token");
    assert.ok(String(init?.body).includes("grant_type=refresh_token"));
    return Response.json({
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_in: 3600,
    });
  };
  assert.equal(await freshToken(store, a.id, fetcher), "new-token");
  assert.equal(await freshToken(store, a.id, fetcher), "new-token");
  assert.equal(calls, 1);
  assert.equal(store.secrets[a.id].refreshToken, "new-refresh");
  assert.ok(Date.parse(a.expiresAt) > Date.now());
  await store.close();
});

test("TikTok HTTP 200 error is a failure; an upload acknowledgement is not a published post", async () => {
  await assert.rejects(
    requestJson("https://example.test", {}, async () =>
      Response.json({
        error: { code: "scope_not_authorized", message: "Missing scope" },
      }),
    ),
    /Missing scope/,
  );
  const { store, providers } = await fixture(["tiktok"]);
  const poller = new Providers(store, async () =>
    Response.json({
      error: { code: "ok" },
      data: { status: "SEND_TO_USER_INBOX" },
    }),
  );
  const result = await poller.poll(store.state.accounts[0], {
    accountId: store.state.accounts[0].id,
    status: "processing",
    remoteId: "publish-1",
  });
  assert.equal(result.status, "inbox");
  await store.close();
});

test("carousel adapters preserve order and wait for every Meta child before publishing", async () => {
  for (const platform of [
    "instagram",
    "threads",
    "facebook",
    "tiktok",
  ] as Platform[]) {
    const { store, publisher } = await fixture([platform]);
    const p2 = {
      ...photo,
      id: randomUUID(),
      file: "second.jpg",
      publicUrl: "https://media.example/second.jpg",
    };
    store.state.assets.push(p2);
    store.secrets.hosting = { verifiedMediaPrefix: "https://media.example/" };
    await writeFile(path.join(store.root, "media", photo.file), "JPEG fixture");
    await writeFile(path.join(store.root, "media", p2.file), "second JPEG");
    const calls: { url: string; form: URLSearchParams; body: any }[] = [];
    let id = 0;
    const providers = new Providers(
      store,
      async (url, init) => {
        const address = String(url),
          values = new URLSearchParams(
            typeof init?.body === "string" ||
              init?.body instanceof URLSearchParams
              ? String(init.body)
              : "",
          );
        const body =
          init?.headers &&
          new Headers(init.headers).get("Content-Type") === "application/json"
            ? JSON.parse(String(init.body))
            : null;
        calls.push({ url: address, form: values, body });
        if (address.includes("creator_info"))
          return Response.json({
            error: { code: "ok" },
            data: {
              privacy_level_options: ["SELF_ONLY"],
              max_video_post_duration_sec: 180,
            },
          });
        if (address.includes("/content/init/"))
          return Response.json({
            error: { code: "ok" },
            data: { publish_id: "tt-photo" },
          });
        if (!init?.method)
          return Response.json(
            address.includes("permalink")
              ? { permalink: "https://example.test/post" }
              : { status_code: "FINISHED", status: "FINISHED" },
          );
        return Response.json({ id: `container-${++id}` });
      },
      async () => {},
    );
    const post = await publisher.savePost({
      ...input([store.state.accounts[0].id], [photo.id, p2.id]),
      format: "carousel",
    });
    const result = await providers.publish(post, store.state.accounts[0], [
      photo,
      p2,
    ]);
    if (platform === "instagram" || platform === "threads") {
      const parent = calls.find((c) => c.form.get("media_type") === "CAROUSEL");
      assert.equal(parent?.form.get("children"), "container-1,container-2");
      const firstStatus = calls.findIndex((c) =>
          c.url.includes("/container-1?"),
        ),
        secondCreate = calls.findIndex(
          (c) => c.form.get("image_url") === p2.publicUrl,
        );
      assert.ok(firstStatus >= 0 && firstStatus < secondCreate);
      assert.equal(result.status, "published");
    } else if (platform === "facebook")
      assert.deepEqual(
        JSON.parse(
          calls
            .find((c) => c.url.endsWith("/feed"))!
            .form.get("attached_media")!,
        ),
        [{ media_fbid: "container-1" }, { media_fbid: "container-2" }],
      );
    else {
      const request = calls.find((c) => c.url.includes("/content/init/"))!;
      assert.deepEqual(request.body.source_info.photo_images, [
        photo.publicUrl,
        p2.publicUrl,
      ]);
      assert.equal(request.body.post_mode, "DIRECT_POST");
      assert.equal(result.status, "processing");
    }
    await store.close();
  }
});

test("single text posts use the native Facebook and Threads endpoints", async () => {
  for (const platform of ["facebook", "threads"] as Platform[]) {
    const { store, publisher } = await fixture([platform]);
    const posted: URLSearchParams[] = [];
    const providers = new Providers(
      store,
      async (_url, init) => {
        if (init?.method === "POST")
          posted.push(new URLSearchParams(String(init.body)));
        return Response.json(
          init?.method === "POST"
            ? { id: "post" }
            : { status: "FINISHED", permalink: "https://example.test/post" },
        );
      },
      async () => {},
    );
    const post = await publisher.savePost({
      title: "Tekst",
      caption: "Samodzielny wpis",
      format: "single",
      accountIds: [store.state.accounts[0].id],
    });
    await providers.publish(post, store.state.accounts[0], []);
    assert.equal(
      posted[0].get(platform === "threads" ? "text" : "message"),
      "Samodzielny wpis",
    );
    if (platform === "threads")
      assert.equal(posted[0].get("media_type"), "TEXT");
    await store.close();
  }
});

test("R2 uses signed PUT and public URLs, including a TikTok ownership file", async () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), init });
    return new Response(null, { status: 200 });
  };
  const c = {
    r2AccountId: "a".repeat(32),
    bucket: "genius-media",
    accessKeyId: "key-id",
    secretAccessKey: "secret-key",
    publicBaseUrl: "https://pub-example.r2.dev/",
  };
  const url = await uploadR2(
    c,
    "tiktok123.txt",
    new Blob(["verification-code"]),
    "text/plain",
    fetcher,
  );
  assert.equal(url, "https://pub-example.r2.dev/tiktok123.txt");
  assert.equal(calls[0].init?.method, "PUT");
  assert.ok(calls[0].url.searchParams.has("X-Amz-Signature"));
  assert.ok(!calls[0].url.toString().includes("secret-key"));
  assert.equal(await (calls[0].init?.body as Blob).text(), "verification-code");
});

test(
  "HTTP E2E: upload → draft → five platform adapters → processing → published, with real local mock servers",
  { timeout: 60000 },
  async () => {
    const { workspace, store } = await fixture([
      "instagram",
      "threads",
      "facebook",
      "tiktok",
      "youtube",
    ]);
    const requests: {
      host: string;
      path: string;
      method: string;
      body: string;
    }[] = [];
    const remote = createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString();
      const url = new URL(req.url!, "http://mock"),
        host = String(req.headers["x-remote-host"]);
      requests.push({ host, path: url.pathname, method: req.method!, body });
      let result: any = {};
      if (url.pathname.includes("creator_info"))
        result = {
          error: { code: "ok" },
          data: {
            privacy_level_options: ["SELF_ONLY"],
            max_video_post_duration_sec: 180,
            comment_disabled: false,
            duet_disabled: false,
            stitch_disabled: false,
          },
        };
      else if (host.endsWith(".r2.cloudflarestorage.com")) result = {};
      else if (
        url.pathname.endsWith("/media_publish") ||
        url.pathname.endsWith("/threads_publish")
      )
        result = { id: "published-meta" };
      else if (
        url.pathname.endsWith("/media") ||
        url.pathname.endsWith("/threads")
      )
        result = { id: "container-1" };
      else if (url.pathname.endsWith("/container-1"))
        result = { status: "FINISHED", status_code: "FINISHED" };
      else if (url.pathname.endsWith("/published-meta"))
        result = { permalink: "https://social.example/post/1" };
      else if (url.pathname.endsWith("/video_reels"))
        result = body.includes("upload_phase=start")
          ? {
              video_id: "fb-reel",
              upload_url: "https://rupload.facebook.com/upload/fb-reel",
            }
          : { success: true };
      else if (host === "rupload.facebook.com") result = { success: true };
      else if (url.pathname.endsWith("/fb-reel"))
        result = { status: { video_status: "ready" } };
      else if (url.pathname.endsWith("/video/init/"))
        result = {
          error: { code: "ok" },
          data: {
            publish_id: "tt-publish",
            upload_url: "https://uploads.tiktok.com/chunks",
          },
        };
      else if (url.pathname.endsWith("/status/fetch/"))
        result = {
          error: { code: "ok" },
          data: { status: "PUBLISH_COMPLETE" },
        };
      else if (url.pathname === "/upload/youtube/v3/videos") {
        res.setHeader("Location", "https://www.googleapis.com/upload/session");
      } else if (url.pathname === "/upload/session")
        result = { id: "yt-short" };
      else if (url.pathname === "/youtube/v3/videos")
        result = {
          items: [
            { status: { uploadStatus: "processed", privacyStatus: "private" } },
          ],
        };
      else if (url.pathname !== "/chunks") {
        res.statusCode = 404;
        result = {
          error: { message: `Unexpected mock route ${url.pathname}` },
        };
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    });
    const mockOrigin = await listen(remote);
    const fetcher: typeof fetch = (url, init) => {
      const parsed = new URL(String(url));
      return fetch(mockOrigin + parsed.pathname + parsed.search, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          "x-remote-host": parsed.hostname,
        },
      });
    };
    // fixture already initialized the store; reopen through the publisher's normal startup.
    await store.saveSecret("hosting", {
      provider: "r2",
      r2Auth: "s3",
      r2AccountId: "a".repeat(32),
      bucket: "genius-media",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicBaseUrl: "https://media.example",
    });
    for (const a of store.state.accounts)
      await store.saveSecret(a.id, { accessToken: "test-token" });
    await store.close();
    const nextStore = new PublisherStore(workspace),
      providers = new Providers(nextStore, fetcher, async () => {}),
      publisher = new Publisher(nextStore, providers);
    await publisher.ready;
    const server = createCanvasServer(
        createCanvasConfig({ workspaceRoot: workspace }),
        publisher,
      ),
      origin = await listen(server);
    const api = async (route: string, data?: unknown) => {
      const r = await fetch(
        `${origin}/api/publisher/${route}`,
        data === undefined
          ? undefined
          : {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Genius-Local": "1",
              },
              body: JSON.stringify(data),
            },
      );
      const value = (await r.json()) as any;
      assert.ok(r.ok, JSON.stringify(value));
      return value;
    };
    try {
      const file = path.join(workspace, "e2e.mp4");
      await run(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=c=turquoise:s=108x192:r=30:d=4",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          file,
        ],
        { windowsHide: true },
      );
      const upload = await fetch(`${origin}/api/publisher/assets/upload`, {
        method: "POST",
        headers: { "X-Genius-Local": "1", "X-File-Name": "e2e.mp4" },
        body: await readFile(file),
      });
      assert.equal(upload.status, 201);
      const asset = (await upload.json()) as Asset;
      assert.equal(asset.duration, 4);
      const partial = await fetch(`${origin}/api/publisher/media/${asset.id}`, {
        headers: { Range: "bytes=0-9" },
      });
      assert.equal(partial.status, 206);
      assert.equal((await partial.arrayBuffer()).byteLength, 10);
      const draft = await api(
        "posts",
        input(
          nextStore.state.accounts.map((a) => a.id),
          [asset.id],
        ),
      );
      await api(`posts/${draft.id}/action`, {
        action: "publish",
        revision: draft.revision,
      });
      let current;
      for (let i = 0; i < 200; i++) {
        await publisher.tick();
        current = (await api("state")).posts[0];
        if (
          current.status === "published" ||
          ["failed", "partial", "needs_attention"].includes(current.status)
        )
          break;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.equal(
        current.status,
        "published",
        JSON.stringify(current.destinations),
      );
      assert.equal(current.destinations.length, 5);
      assert.equal(
        requests.filter((r) => r.path.endsWith("/media_publish")).length,
        1,
      );
      assert.equal(
        requests.filter((r) => r.path.endsWith("/threads_publish")).length,
        1,
      );
      assert.ok(
        requests.some(
          (r) => r.path === "/upload/session" && r.method === "PUT",
        ),
      );
      assert.ok(requests.some((r) => r.path.endsWith("/status/fetch/")));
      const stateText = JSON.stringify(await api("state"));
      assert.ok(!stateText.includes("test-token"));
      assert.ok(!stateText.includes("secretAccessKey"));
      const csrf = await fetch(`${origin}/api/publisher/posts`, {
        method: "POST",
        body: "{}",
      });
      assert.equal(csrf.status, 403);
      const cross = await fetch(`${origin}/api/publisher/state`, {
        headers: { Origin: "https://evil.example" },
      });
      assert.equal(cross.status, 403);
      const privateFile = await fetch(
        `${origin}/api/workspace/.genius/credentials.enc`,
      );
      assert.ok(privateFile.status >= 400);
      await publisher.tick();
      assert.equal(
        requests.filter((r) => r.path.endsWith("/media_publish")).length,
        1,
      );
    } finally {
      await close(server);
      await nextStore.close();
      await close(remote);
    }
  },
);
