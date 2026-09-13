import { openAsBlob } from "node:fs";
import path from "node:path";
import type { Account, Asset, Creator, Destination, Post } from "./model.js";
import type { PublisherStore } from "./store.js";
import {
  ApiError,
  bearer,
  form,
  freshToken,
  publicMedia,
  requestJson,
  uploadChunks,
  type Fetch,
} from "./transport.js";

export type PublishResult = {
  status: "published" | "processing" | "inbox";
  remoteId: string;
  remoteUrl?: string;
};
export class Providers {
  constructor(
    readonly store: PublisherStore,
    readonly fetcher: Fetch = fetch,
    readonly pause = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms)),
  ) {}
  private graph(account: Account) {
    return `https://graph.facebook.com/${this.store.secrets[account.id]?.apiVersion || "v23.0"}`;
  }
  private async metaReady(
    base: string,
    id: string,
    token: string,
    threads = false,
  ) {
    for (let i = 0; i < 120; i++) {
      const result = await requestJson(
        `${base}/${id}?fields=${threads ? "status,error_message" : "status_code,status"}`,
        { headers: bearer(token) },
        this.fetcher,
      );
      const status = threads ? result.status : result.status_code;
      if (status === "FINISHED" || status === "PUBLISHED") return;
      if (status === "ERROR" || status === "EXPIRED")
        throw new Error(
          `Przetwarzanie pliku: ${result.error_message || result.status || status}`,
        );
      await this.pause(5000);
    }
    throw new Error(
      "Platforma przetwarza plik dłużej niż 10 minut. Publikacja nie została zlecona.",
    );
  }
  async creator(account: Account): Promise<Creator> {
    const token = await freshToken(this.store, account.id, this.fetcher);
    const response = await requestJson(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: { ...bearer(token), "Content-Type": "application/json" },
        body: "{}",
      },
      this.fetcher,
    );
    if (!Array.isArray(response.data?.privacy_level_options))
      throw new Error(
        "TikTok nie udostępnił opcji publikowania dla tego konta.",
      );
    return response.data;
  }
  async verify(account: Account) {
    const token = await freshToken(this.store, account.id, this.fetcher);
    let info: any;
    if (account.platform === "tiktok") {
      // user.info.basic is sufficient for Inbox; Direct Post checks creator_info separately.
      const body = await requestJson(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
        { headers: bearer(token) },
        this.fetcher,
      );
      info = body.data?.user;
      if (!info?.open_id)
        throw new Error(
          "TikTok nie zwrócił tożsamości konta. Sprawdź uprawnienie user.info.basic.",
        );
      if (
        account.verifiedAt &&
        account.remoteId &&
        account.remoteId !== info.open_id
      )
        throw new Error(
          "Ten token należy do innego konta. Dodaj je jako osobne konto.",
        );
      account.remoteId = info.open_id;
      account.avatar = info?.avatar_url;
      account.name = info?.display_name || account.name;
    } else if (account.platform === "youtube") {
      const body = await requestJson(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: bearer(token) },
        this.fetcher,
      );
      info = body.items?.[0];
      if (!info) throw new Error("To konto Google nie ma kanału YouTube.");
      if (
        account.verifiedAt &&
        account.remoteId &&
        account.remoteId !== info.id
      )
        throw new Error(
          "Ten token należy do innego kanału. Dodaj go jako osobne konto.",
        );
      account.remoteId = info.id;
      account.name = info.snippet.title;
    } else {
      const isThreads = account.platform === "threads";
      const base = isThreads
        ? "https://graph.threads.net/v1.0"
        : this.graph(account);
      const fields =
        account.platform === "instagram" || isThreads
          ? "id,username"
          : "id,name";
      info = await requestJson(
        `${base}/${account.remoteId || "me"}?fields=${fields}`,
        { headers: bearer(token) },
        this.fetcher,
      );
      account.remoteId = info.id;
      account.name = info.username || info.name || account.name;
    }
    if (!account.remoteId)
      throw new Error("Platforma nie zwróciła identyfikatora konta.");
    account.connected = true;
    account.verifiedAt = new Date().toISOString();
    return account;
  }
  async publish(
    post: Post,
    account: Account,
    assets: Asset[],
  ): Promise<PublishResult> {
    const token = await freshToken(this.store, account.id, this.fetcher);
    const graph = this.graph(account),
      id = encodeURIComponent(account.remoteId);
    const submit = (url: string, values: Record<string, unknown>) =>
      requestJson(
        url,
        { method: "POST", headers: bearer(token), body: form(values) },
        this.fetcher,
      );
    const local = (a: Asset) => path.join(this.store.root, "media", a.file);
    if (account.platform === "instagram" || account.platform === "threads") {
      const threads = account.platform === "threads";
      const base = threads ? "https://graph.threads.net/v1.0" : graph;
      const url = `${base}/${id}/${threads ? "threads" : "media"}`;
      const caption = threads
        ? { text: post.caption }
        : { caption: post.caption };
      const mediaFields = async (a: Asset, child: boolean) => ({
        media_type:
          a.type === "image"
            ? threads
              ? "IMAGE"
              : undefined
            : threads || child
              ? "VIDEO"
              : "REELS",
        [a.type === "image" ? "image_url" : "video_url"]: await publicMedia(
          this.store,
          a,
          this.fetcher,
        ),
        ...(child ? { is_carousel_item: true } : {}),
        ...(threads && a.type === "image" ? { alt_text: post.title } : {}),
      });
      let container: any;
      if (assets.length > 1) {
        const children: string[] = [];
        for (const asset of assets) {
          const child = await submit(url, await mediaFields(asset, true));
          if (!child.id) throw new Error("Brak identyfikatora materiału.");
          await this.metaReady(base, child.id, token, threads);
          children.push(child.id);
        }
        container = await submit(url, {
          media_type: "CAROUSEL",
          children: children.join(","),
          ...caption,
        });
      } else
        container = await submit(url, {
          ...(assets[0]
            ? await mediaFields(assets[0], false)
            : { media_type: "TEXT" }),
          ...caption,
          ...(!threads && assets[0]?.type === "video"
            ? { share_to_feed: true }
            : {}),
        });
      if (!container.id)
        throw new Error("Platforma nie zwróciła identyfikatora kontenera.");
      await this.metaReady(base, container.id, token, threads);
      const result = await submit(
        `${base}/${id}/${threads ? "threads_publish" : "media_publish"}`,
        { creation_id: container.id },
      );
      if (!result.id)
        throw new ApiError(
          "Brak identyfikatora publikacji. Sprawdź konto.",
          true,
        );
      let remoteUrl: string | undefined;
      try {
        remoteUrl = (
          await requestJson(
            `${base}/${result.id}?fields=permalink`,
            { headers: bearer(token) },
            this.fetcher,
          )
        ).permalink;
      } catch {
        /* Publication already succeeded. */
      }
      return { status: "published", remoteId: result.id, remoteUrl };
    }
    if (account.platform === "facebook") {
      if (assets[0]?.type === "video") {
        const asset = assets[0];
        if (post.format === "reel") {
          const session = await submit(`${graph}/${id}/video_reels`, {
            upload_phase: "start",
          });
          if (
            !session.video_id ||
            !session.upload_url?.startsWith("https://rupload.facebook.com/")
          )
            throw new Error("Facebook nie zwrócił sesji wysyłki.");
          await requestJson(
            session.upload_url,
            {
              method: "POST",
              headers: {
                Authorization: `OAuth ${token}`,
                offset: "0",
                file_size: String(asset.bytes),
                "Content-Type": "application/octet-stream",
              },
              body: await openAsBlob(local(asset)),
              signal: AbortSignal.timeout(600000),
            },
            this.fetcher,
          );
          await submit(`${graph}/${id}/video_reels`, {
            upload_phase: "finish",
            video_id: session.video_id,
            video_state: "PUBLISHED",
            title: post.title,
            description: post.caption,
          });
          return { status: "processing", remoteId: session.video_id };
        }
        const body = new FormData();
        body.set("source", await openAsBlob(local(asset)), asset.name);
        body.set("title", post.title);
        body.set("description", post.caption);
        const result = await requestJson(
          `${graph}/${id}/videos`,
          {
            method: "POST",
            headers: bearer(token),
            body,
            signal: AbortSignal.timeout(600000),
          },
          this.fetcher,
        );
        if (!result.id)
          throw new ApiError("Brak identyfikatora filmu. Sprawdź konto.", true);
        return { status: "processing", remoteId: result.id };
      }
      const attached: { media_fbid: string }[] = [];
      for (const asset of assets) {
        const body = new FormData();
        body.set("source", await openAsBlob(local(asset)), asset.name);
        body.set("published", "false");
        const photo = await requestJson(
          `${graph}/${id}/photos`,
          { method: "POST", headers: bearer(token), body },
          this.fetcher,
        );
        if (!photo.id) throw new Error("Facebook nie przyjął zdjęcia.");
        attached.push({ media_fbid: photo.id });
      }
      const result = await submit(`${graph}/${id}/feed`, {
        message: post.caption,
        ...(attached.length ? { attached_media: attached } : {}),
      });
      if (!result.id)
        throw new ApiError("Brak identyfikatora posta. Sprawdź konto.", true);
      return {
        status: "published",
        remoteId: result.id,
        remoteUrl: `https://www.facebook.com/${result.id}`,
      };
    }
    if (account.platform === "tiktok") {
      const options = post.options,
        direct = options.tiktokMode === "direct";
      if (direct) {
        const creator = await this.creator(account);
        if (!creator.privacy_level_options.includes(options.tiktokPrivacy))
          throw new Error(
            "Wybrana widoczność TikToka nie jest dostępna. Odśwież opcje konta.",
          );
        if (
          assets.some(
            (a) => (a.duration || 0) > creator.max_video_post_duration_sec,
          )
        )
          throw new Error(
            `TikTok: konto dopuszcza film do ${creator.max_video_post_duration_sec} sekund.`,
          );
        if (
          (options.allowComments && creator.comment_disabled) ||
          (options.allowDuet && creator.duet_disabled) ||
          (options.allowStitch && creator.stitch_disabled)
        )
          throw new Error(
            "TikTok zmienił dozwolone interakcje. Odśwież opcje konta.",
          );
      }
      const isPhoto = assets[0].type === "image",
        asset = assets[0];
      const chunk = Math.min(10 * 1024 * 1024, asset.bytes);
      const postInfo = {
        title: isPhoto ? post.title : post.caption,
        privacy_level: options.tiktokPrivacy,
        disable_comment: !options.allowComments,
        ...(isPhoto
          ? { description: post.caption, auto_add_music: false }
          : {
              disable_duet: !options.allowDuet,
              disable_stitch: !options.allowStitch,
              video_cover_timestamp_ms: 0,
            }),
        brand_content_toggle: options.brandedContent,
        brand_organic_toggle: options.ownBrand,
        is_aigc: options.aiGenerated,
      };
      let source: any;
      if (isPhoto) {
        const urls = [];
        for (const a of assets)
          urls.push(await publicMedia(this.store, a, this.fetcher));
        const prefix = this.store.secrets.hosting?.verifiedMediaPrefix;
        if (!prefix || !urls.every((u) => u.startsWith(prefix)))
          throw new Error(
            "TikTok wymaga zweryfikowanej domeny/prefiksu zdjęć. Ustaw go w hostingu mediów po weryfikacji w TikTok Dev.",
          );
        source = {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: urls,
        };
      } else
        source = {
          source: "FILE_UPLOAD",
          video_size: asset.bytes,
          chunk_size: chunk,
          total_chunk_count: Math.max(1, Math.floor(asset.bytes / chunk)),
        };
      const endpoint = isPhoto
        ? "publish/content/init/"
        : direct
          ? "publish/video/init/"
          : "publish/inbox/video/init/";
      const body = {
        source_info: source,
        ...(direct ? { post_info: postInfo } : {}),
        ...(isPhoto
          ? {
              media_type: "PHOTO",
              post_mode: direct ? "DIRECT_POST" : "MEDIA_UPLOAD",
            }
          : {}),
      };
      const result = await requestJson(
        `https://open.tiktokapis.com/v2/post/${endpoint}`,
        {
          method: "POST",
          headers: { ...bearer(token), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        this.fetcher,
      );
      if (!result.data?.publish_id)
        throw new ApiError("TikTok nie zwrócił identyfikatora wysyłki.", true);
      if (!isPhoto) {
        if (!result.data.upload_url?.startsWith("https://"))
          throw new ApiError("TikTok nie zwrócił adresu wysyłki.", true);
        await uploadChunks(
          result.data.upload_url,
          local(asset),
          asset.bytes,
          asset.mime,
          chunk,
          this.fetcher,
        );
      }
      return { status: "processing", remoteId: result.data.publish_id };
    }
    const asset = assets[0];
    const response = await this.fetcher(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          ...bearer(token),
          "Content-Type": "application/json",
          "X-Upload-Content-Type": asset.mime,
          "X-Upload-Content-Length": String(asset.bytes),
        },
        body: JSON.stringify({
          snippet: {
            title: post.title,
            description: post.caption,
            categoryId: "22",
          },
          status: {
            privacyStatus: post.options.youtubePrivacy,
            selfDeclaredMadeForKids: post.options.madeForKids,
          },
        }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!response.ok)
      throw new Error(
        `YouTube: rozpoczęcie wysyłki HTTP ${response.status}. Sprawdź uprawnienie youtube.upload.`,
      );
    const uploadUrl = response.headers.get("location");
    if (!uploadUrl?.startsWith("https://www.googleapis.com/"))
      throw new Error("YouTube nie zwrócił sesji wysyłki.");
    const result = await uploadChunks(
      uploadUrl,
      local(asset),
      asset.bytes,
      asset.mime,
      8 * 1024 * 1024,
      this.fetcher,
      bearer(token),
    );
    if (!result?.id)
      throw new ApiError(
        "Brak identyfikatora filmu YouTube. Sprawdź kanał przed ponowieniem.",
        true,
      );
    return {
      status: "processing",
      remoteId: result.id,
      remoteUrl: `https://www.youtube.com/shorts/${result.id}`,
    };
  }
  async poll(
    account: Account,
    destination: Destination,
  ): Promise<PublishResult> {
    const token = await freshToken(this.store, account.id, this.fetcher),
      remoteId = destination.remoteId!;
    if (account.platform === "tiktok") {
      const result = await requestJson(
        "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
        {
          method: "POST",
          headers: { ...bearer(token), "Content-Type": "application/json" },
          body: JSON.stringify({ publish_id: remoteId }),
        },
        this.fetcher,
      );
      const data = result.data;
      if (data.status === "FAILED")
        throw new Error(
          `TikTok: ${data.fail_reason || "publikacja odrzucona"}`,
        );
      return {
        status:
          data.status === "PUBLISH_COMPLETE"
            ? "published"
            : data.status === "SEND_TO_USER_INBOX"
              ? "inbox"
              : "processing",
        remoteId,
      };
    }
    if (account.platform === "youtube") {
      const body = await requestJson(
        `https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(remoteId)}`,
        { headers: bearer(token) },
        this.fetcher,
      );
      const video = body.items?.[0];
      if (
        ["failed", "rejected", "deleted"].includes(video?.status?.uploadStatus)
      )
        throw new Error(
          `YouTube: ${video.status.rejectionReason || video.status.failureReason || video.status.uploadStatus}`,
        );
      return {
        status:
          video?.status?.uploadStatus === "processed"
            ? "published"
            : "processing",
        remoteId,
        remoteUrl: `https://www.youtube.com/shorts/${remoteId}`,
      };
    }
    const result = await requestJson(
      `${this.graph(account)}/${remoteId}?fields=status,permalink_url`,
      { headers: bearer(token) },
      this.fetcher,
    );
    if (result.status?.video_status === "error")
      throw new Error("Facebook odrzucił przetwarzanie filmu.");
    return {
      status:
        result.status?.video_status === "ready" ? "published" : "processing",
      remoteId,
      remoteUrl:
        result.permalink_url || `https://www.facebook.com/reel/${remoteId}`,
    };
  }
}
