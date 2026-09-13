import { randomUUID } from "node:crypto";
import { postInput, validatePost, type Post, type PostInput } from "./model.js";
import { PublisherStore } from "./store.js";
import { Providers } from "./providers.js";
import { ApiError } from "./transport.js";

export class Publisher {
  readonly ready: Promise<void>;
  private running = false;
  private timer?: NodeJS.Timeout;
  private stopping = false;
  constructor(
    readonly store: PublisherStore,
    readonly providers = new Providers(store),
    readonly now = () => new Date(),
  ) {
    this.ready = store.initialize();
  }
  start() {
    this.timer = setInterval(() => {
      void this.tick().catch(() => {
        /* Keep queue durable; health exposes initialization errors. */
      });
    }, 15000);
    this.timer.unref();
    void this.tick().catch(() => {});
  }
  async stop() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.ready.catch(() => {});
    while (this.running) await new Promise((r) => setTimeout(r, 25));
    await this.store.close();
  }
  hostingReady() {
    const c = this.store.secrets.hosting;
    return Boolean(
      c?.r2AccountId &&
      c.bucket &&
      c.publicBaseUrl &&
      (c.r2Auth === "wrangler" || (c.accessKeyId && c.secretAccessKey)),
    );
  }
  validate(input: PostInput) {
    return validatePost(
      input,
      this.store.state.assets,
      this.store.state.accounts,
      this.hostingReady(),
    );
  }
  async savePost(
    value: unknown,
    id?: string,
    revision?: number,
  ): Promise<Post> {
    const input = postInput.parse(value);
    await this.ready;
    return this.store.exclusive(async () => {
      const previous = id
        ? this.store.state.posts.find((p) => p.id === id)
        : undefined;
      if (id && !previous) throw new Error("Nie znaleziono publikacji.");
      if (previous && previous.revision !== revision)
        throw new Error(
          "Publikacja zmieniła się w innym oknie. Odśwież ją przed zapisem.",
        );
      if (
        previous &&
        !["draft", "scheduled", "cancelled"].includes(previous.status)
      )
        throw new Error(
          "Wysyłka już się rozpoczęła. Utwórz nowy szkic, aby zmienić treść.",
        );
      if (previous?.status === "scheduled") {
        const errors = this.validate(input);
        if (errors.length) throw new Error(errors.join("\n"));
      }
      const time = this.now().toISOString();
      const post: Post = {
        ...input,
        id: previous?.id || randomUUID(),
        revision: (previous?.revision || 0) + 1,
        createdAt: previous?.createdAt || time,
        updatedAt: time,
        status: "draft",
        destinations: input.accountIds.map((accountId) => ({
          accountId,
          status: "pending",
        })),
      };
      // Editing a scheduled post always returns it to draft so it cannot publish mid-edit.
      if (previous)
        this.store.state.posts.splice(
          this.store.state.posts.indexOf(previous),
          1,
          post,
        );
      else this.store.state.posts.unshift(post);
      await this.store.save();
      return post;
    });
  }
  async action(
    id: string,
    action: string,
    revision: number,
    scheduledAt?: string,
  ) {
    await this.ready;
    const post = await this.store.exclusive(async () => {
      const post = this.store.state.posts.find((p) => p.id === id);
      if (!post) throw new Error("Nie znaleziono publikacji.");
      if (post.revision !== revision)
        throw new Error("Publikacja zmieniła się. Odśwież widok.");
      if (action === "cancel") {
        if (!["draft", "scheduled"].includes(post.status))
          throw new Error(
            "Wysyłka już ruszyła. Nie można jej cofnąć lokalnie.",
          );
        post.status = "cancelled";
      } else if (
        action === "schedule" ||
        action === "publish" ||
        action === "retry"
      ) {
        if (action === "retry") {
          if (!post.destinations.some((d) => d.status === "failed"))
            throw new Error(
              "Brak nieudanych wysyłek do ponowienia. Wynik nieznany wymaga sprawdzenia na platformie.",
            );
        } else if (!["draft", "scheduled", "cancelled"].includes(post.status))
          throw new Error(
            "Ta publikacja jest już w kolejce lub została wysłana.",
          );
        const errors = this.validate(post);
        if (errors.length) throw new Error(errors.join("\n"));
        if (action === "schedule") {
          if (
            !scheduledAt ||
            !Number.isFinite(Date.parse(scheduledAt)) ||
            Date.parse(scheduledAt) <= this.now().getTime()
          )
            throw new Error("Wybierz przyszłą datę i godzinę.");
          post.scheduledAt = new Date(scheduledAt).toISOString();
        } else post.scheduledAt = this.now().toISOString();
        if (action === "retry")
          for (const d of post.destinations)
            if (d.status === "failed") {
              d.status = "pending";
              delete d.error;
              delete d.remoteId;
              delete d.remoteUrl;
            }
        post.status = "scheduled";
      } else throw new Error("Nieznana operacja.");
      post.revision++;
      post.updatedAt = this.now().toISOString();
      await this.store.save();
      return structuredClone(post);
    });
    if (action !== "cancel") void this.tick().catch(() => {});
    return post;
  }
  private aggregate(post: Post) {
    const states = post.destinations.map((d) => d.status);
    post.status = states.includes("needs_attention")
      ? "needs_attention"
      : states.some((s) => ["publishing", "processing", "pending"].includes(s))
        ? "publishing"
        : states.every((s) => s === "published")
          ? "published"
          : states.includes("failed")
            ? states.every((s) => s === "failed")
              ? "failed"
              : "partial"
            : states.includes("inbox")
              ? "inbox"
              : "partial";
    post.updatedAt = this.now().toISOString();
    post.revision++;
  }
  async tick() {
    await this.ready;
    if (this.running || this.stopping) return;
    this.running = true;
    try {
      for (const post of this.store.state.posts) {
        if (this.stopping) break;
        const due =
          ["scheduled", "publishing", "needs_attention", "partial"].includes(
            post.status,
          ) &&
          Boolean(post.scheduledAt) &&
          Date.parse(post.scheduledAt!) <= this.now().getTime();
        if (
          !due &&
          !["publishing", "inbox", "needs_attention", "partial"].includes(
            post.status,
          )
        )
          continue;
        for (const destination of post.destinations) {
          if (!["pending", "processing", "inbox"].includes(destination.status))
            continue;
          if (
            destination.status === "pending" &&
            !due &&
            post.status !== "publishing"
          )
            continue;
          const account = this.store.state.accounts.find(
            (a) => a.id === destination.accountId,
          );
          const polling =
            destination.status === "processing" ||
            destination.status === "inbox";
          try {
            if (!account) throw new Error("Konto zostało odłączone.");
            if (!polling) {
              const errors = this.validate({
                ...post,
                accountIds: [account.id],
              });
              if (errors.length) throw new Error(errors.join("\n"));
              const claimed = await this.store.exclusive(async () => {
                if (
                  !this.store.state.posts.includes(post) ||
                  ![
                    "scheduled",
                    "publishing",
                    "needs_attention",
                    "partial",
                  ].includes(post.status) ||
                  destination.status !== "pending"
                )
                  return false;
                destination.status = "publishing";
                this.aggregate(post);
                await this.store.save();
                return true;
              });
              if (!claimed) continue;
            }
            const result = polling
              ? await this.providers.poll(account, destination)
              : await this.providers.publish(
                  post,
                  account,
                  post.assetIds.map(
                    (id) => this.store.state.assets.find((a) => a.id === id)!,
                  ),
                );
            await this.store.exclusive(async () => {
              Object.assign(destination, result, {
                updatedAt: this.now().toISOString(),
              });
              delete destination.error;
              this.aggregate(post);
              await this.store.save();
            });
          } catch (e) {
            await this.store.exclusive(async () => {
              // Poll failures never trigger a second upload; retain the remote ID and retry status checks.
              const uncertain = e instanceof ApiError && e.uncertain;
              if (!polling)
                destination.status = uncertain ? "needs_attention" : "failed";
              else if (
                !(e instanceof ApiError) &&
                /odrzuci|TikTok:|YouTube:/.test((e as Error).message)
              )
                destination.status = "failed";
              destination.error = this.store.redact(
                e instanceof Error ? e.message : "Nie udało się wysłać.",
              );
              destination.updatedAt = this.now().toISOString();
              this.aggregate(post);
              await this.store.save();
            });
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
