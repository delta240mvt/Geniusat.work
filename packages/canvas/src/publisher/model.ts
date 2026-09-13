import { z } from "zod";

export const platformSchema = z.enum([
  "instagram",
  "threads",
  "facebook",
  "tiktok",
  "youtube",
]);
export type Platform = z.infer<typeof platformSchema>;
export const platformNames: Record<Platform, string> = {
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
};
export const postInput = z
  .object({
    title: z.string().trim().min(1).max(100),
    caption: z.string().max(5000).default(""),
    format: z.enum(["reel", "carousel", "single"]),
    assetIds: z.array(z.string().uuid()).max(35).default([]),
    accountIds: z.array(z.string().uuid()).max(20).default([]),
    scheduledAt: z.string().datetime({ offset: true }).nullable().default(null),
    options: z
      .object({
        youtubePrivacy: z
          .enum(["private", "unlisted", "public"])
          .default("private"),
        madeForKids: z.boolean().default(false),
        tiktokMode: z.enum(["direct", "inbox"]).default("inbox"),
        tiktokPrivacy: z.string().max(80).default(""),
        tiktokConsent: z.boolean().default(false),
        allowComments: z.boolean().default(false),
        allowDuet: z.boolean().default(false),
        allowStitch: z.boolean().default(false),
        brandedContent: z.boolean().default(false),
        ownBrand: z.boolean().default(false),
        aiGenerated: z.boolean().default(false),
      })
      .default({
        youtubePrivacy: "private",
        madeForKids: false,
        tiktokMode: "inbox",
        tiktokPrivacy: "",
        tiktokConsent: false,
        allowComments: false,
        allowDuet: false,
        allowStitch: false,
        brandedContent: false,
        ownBrand: false,
        aiGenerated: false,
      }),
  })
  .strict();
export type PostInput = z.infer<typeof postInput>;
export type DestinationStatus =
  | "pending"
  | "publishing"
  | "processing"
  | "published"
  | "inbox"
  | "failed"
  | "needs_attention";
export type Destination = {
  accountId: string;
  status: DestinationStatus;
  remoteId?: string;
  remoteUrl?: string;
  error?: string;
  updatedAt?: string;
};
export type Post = PostInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  status:
    | "draft"
    | "scheduled"
    | "publishing"
    | "published"
    | "partial"
    | "failed"
    | "needs_attention"
    | "inbox"
    | "cancelled";
  destinations: Destination[];
};
export type Asset = {
  id: string;
  name: string;
  type: "image" | "video";
  mime: string;
  file: string;
  bytes: number;
  width: number;
  height: number;
  duration?: number;
  createdAt: string;
  source?: string;
  publicUrl?: string;
};
export type Account = {
  id: string;
  platform: Platform;
  name: string;
  remoteId: string;
  connected: boolean;
  verifiedAt?: string;
  expiresAt?: string;
  avatar?: string;
  creator?: Creator;
};
export type Creator = {
  privacy_level_options: string[];
  max_video_post_duration_sec: number;
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  creator_username?: string;
  creator_nickname?: string;
  creator_avatar_url?: string;
};
export type State = {
  version: 1;
  assets: Asset[];
  accounts: Account[];
  posts: Post[];
};
export const credentialSchema = z
  .object({
    accessToken: z.string().max(8000).optional(),
    refreshToken: z.string().max(8000).optional(),
    clientId: z.string().max(500).optional(),
    clientSecret: z.string().max(8000).optional(),
    verifiedMediaPrefix: z.string().max(2000).optional(),
    redirectUri: z.string().max(2000).optional(),
    apiVersion: z
      .string()
      .regex(/^v\d+\.0$/)
      .optional(),
    provider: z.literal("r2").optional(),
    r2Auth: z.enum(["wrangler", "s3"]).optional(),
    r2AccountId: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    bucket: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
      .optional(),
    accessKeyId: z.string().max(500).optional(),
    secretAccessKey: z.string().max(8000).optional(),
    publicBaseUrl: z.string().url().startsWith("https://").max(2000).optional(),
  })
  .strict();
export type Credentials = z.infer<typeof credentialSchema>;

export function validatePost(
  post: PostInput,
  assets: Asset[],
  accounts: Account[],
  hosting: boolean,
): string[] {
  const issues: string[] = [];
  if (!post.accountIds.length)
    issues.push("Wybierz przynajmniej jedno konto do publikacji.");
  const media = post.assetIds.map((id) => assets.find((a) => a.id === id));
  if (media.some((a) => !a))
    issues.push("Nie znaleziono jednego z materiałów. Dodaj go ponownie.");
  if (new Set(post.assetIds).size !== post.assetIds.length)
    issues.push("Ten sam materiał dodano dwa razy.");
  if (new Set(post.accountIds).size !== post.accountIds.length)
    issues.push("Konto może wystąpić tylko raz.");
  const valid = media.filter((a): a is Asset => Boolean(a));
  if (
    post.format === "reel" &&
    (valid.length !== 1 || valid[0]?.type !== "video")
  )
    issues.push("Rolka wymaga jednego pliku wideo.");
  if (post.format === "carousel" && valid.length < 2)
    issues.push("Karuzela wymaga przynajmniej dwóch materiałów.");
  if (post.format === "single" && valid.length > 1)
    issues.push("Pojedynczy post może zawierać najwyżej jeden materiał.");
  if (!valid.length && !post.caption.trim())
    issues.push("Dodaj treść lub materiał.");
  for (const id of post.accountIds) {
    const account = accounts.find((a) => a.id === id);
    if (!account) {
      issues.push("Wybierz istniejące konto.");
      continue;
    }
    const p = account.platform,
      name = platformNames[p];
    if (!account.connected)
      issues.push(`${name}: połącz konto w ustawieniach.`);
    if (
      (p === "instagram" ||
        p === "threads" ||
        (p === "tiktok" && valid[0]?.type === "image")) &&
      valid.some((a) => !a.publicUrl) &&
      !hosting
    )
      issues.push(`${name}: dodaj hosting Cloudflare R2.`);
    const maxCaption =
      p === "threads" ? 500 : p === "instagram" || p === "tiktok" ? 2200 : 5000;
    if (post.caption.length > maxCaption)
      issues.push(`${name}: maksymalnie ${maxCaption} znaków opisu.`);
    if (p === "instagram") {
      if (!valid.length) issues.push("Instagram wymaga zdjęcia lub filmu.");
      if (valid.length > 10)
        issues.push("Instagram: maksymalnie 10 elementów karuzeli przez API.");
      if (valid.some((a) => a.type === "image" && a.mime !== "image/jpeg"))
        issues.push(
          "Instagram wymaga zdjęć JPEG — biblioteka konwertuje je automatycznie.",
        );
      if (
        post.format === "reel" &&
        valid.some((a) => (a.duration ?? 0) < 3 || (a.duration ?? 0) > 900)
      )
        issues.push("Instagram: rolka musi trwać od 3 sekund do 15 minut.");
    }
    if (p === "threads" && valid.length > 20)
      issues.push("Threads: maksymalnie 20 elementów.");
    if (
      p === "facebook" &&
      valid.length > 1 &&
      valid.some((a) => a.type === "video")
    )
      issues.push(
        "Facebook: post ze zdjęciami może zawierać tylko obrazy. Filmy publikuj osobno.",
      );
    if (
      p === "youtube" &&
      (valid.length !== 1 ||
        valid[0]?.type !== "video" ||
        valid[0].width > valid[0].height ||
        (valid[0].duration ?? 0) > 180)
    )
      issues.push(
        "YouTube Shorts: wybierz jeden pionowy lub kwadratowy film do 3 minut. Zdjęcia i karuzele nie mają odpowiednika w tym API.",
      );
    if (p === "tiktok") {
      if (!valid.length) issues.push("TikTok wymaga filmu lub zdjęć.");
      if (valid.length > 1 && valid.some((a) => a.type === "video"))
        issues.push("TikTok: wybierz jeden film albo zestaw zdjęć.");
      if (post.options.tiktokMode === "direct" && !post.options.tiktokPrivacy)
        issues.push("TikTok: wybierz widoczność publikacji.");
      if (!post.options.tiktokConsent)
        issues.push("TikTok: potwierdź zgodę na wysłanie treści.");
      if (
        post.options.tiktokMode === "direct" &&
        post.options.brandedContent &&
        post.options.tiktokPrivacy === "SELF_ONLY"
      )
        issues.push("TikTok: materiał partnerski nie może być prywatny.");
    }
  }
  return [...new Set(issues)];
}
