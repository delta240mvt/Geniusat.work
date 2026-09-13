import { createReadStream, createWriteStream } from "node:fs";
import { stat, realpath, rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Asset } from "./model.js";
import type { PublisherStore } from "./store.js";

const run = promisify(execFile);
const maxBytes = 2 * 1024 ** 3;
const extensions = new Set([".mp4", ".mov", ".jpg", ".jpeg", ".png", ".webp"]);

export async function addMedia(
  store: PublisherStore,
  name: string,
  input: Readable,
  source?: string,
): Promise<Asset> {
  name = path.basename(name).slice(0, 160);
  const ext = path.extname(name).toLowerCase();
  if (!extensions.has(ext))
    throw new Error("Dodaj MP4, MOV, JPG, PNG lub WebP.");
  const id = randomUUID(),
    temp = path.join(store.root, "media", `${id}.upload`);
  let bytes = 0;
  try {
    await pipeline(
      input,
      new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          callback(
            bytes > maxBytes
              ? new Error("Maksymalny rozmiar pliku to 2 GB.")
              : null,
            chunk,
          );
        },
      }),
      createWriteStream(temp, { flags: "wx" }),
    );
    const probe = await run(
      "ffprobe",
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", temp],
      { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    const info = JSON.parse(probe.stdout);
    const video = info.streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    );
    if (!video?.width || !video?.height)
      throw new Error("Nie można odczytać obrazu z tego pliku.");
    const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    const outputExt = isImage ? ".jpg" : ext;
    const file = `${id}${outputExt}`,
      destination = path.join(store.root, "media", file);
    if (isImage) {
      // A common JPEG derivative fits every photo API; the source file is untouched.
      await run(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          temp,
          "-vf",
          "scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2:color=0xF8F7F3",
          "-frames:v",
          "1",
          "-q:v",
          "2",
          destination,
        ],
        { windowsHide: true, timeout: 60000 },
      );
    } else await rename(temp, destination);
    const rotation = Number(
      video.side_data_list?.find(
        (s: { rotation?: number }) => s.rotation !== undefined,
      )?.rotation ??
        video.tags?.rotate ??
        0,
    );
    const rotated = Math.abs(rotation) % 180 === 90;
    const asset: Asset = {
      id,
      name: isImage ? name.replace(/\.[^.]+$/, ".jpg") : name,
      type: isImage ? "image" : "video",
      mime: isImage
        ? "image/jpeg"
        : ext === ".mov"
          ? "video/quicktime"
          : "video/mp4",
      file,
      bytes: (await stat(destination)).size,
      width: isImage ? 1080 : Number(rotated ? video.height : video.width),
      height: isImage ? 1350 : Number(rotated ? video.width : video.height),
      duration: isImage ? undefined : Number(info.format.duration),
      createdAt: new Date().toISOString(),
      source,
    };
    if (!isImage && (!Number.isFinite(asset.duration) || asset.duration! <= 0))
      throw new Error("Film ma nieprawidłowy czas trwania.");
    await store.exclusive(async () => {
      store.state.assets.unshift(asset);
      await store.save();
    });
    return asset;
  } finally {
    await rm(temp, { force: true });
  }
}

export async function importMedia(
  store: PublisherStore,
  workspace: string,
  relative: string,
) {
  const normalized = relative.replaceAll("\\", "/");
  if (
    !/^apps\/genius-(content|brains|scale)\/(input|output|public|AI Studio)\//.test(
      normalized,
    ) ||
    normalized.split("/").some((p) => p.startsWith("."))
  )
    throw new Error("Importuj plik z biblioteki lub prześlij go z dysku.");
  const root = await realpath(workspace),
    full = await realpath(path.resolve(root, normalized));
  if (
    !full.toLowerCase().startsWith((root + path.sep).toLowerCase()) ||
    (await stat(full)).size > maxBytes
  )
    throw new Error("Plik poza biblioteką lub większy niż 2 GB.");
  return addMedia(
    store,
    path.basename(full),
    createReadStream(full),
    normalized,
  );
}
