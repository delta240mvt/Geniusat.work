import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { Account } from "./model.js";
import type { Publisher } from "./service.js";
import { bearer, form, requestJson } from "./transport.js";

type Attempt = {
  accountId: string;
  verifier: string;
  redirect: string;
  expires: number;
};
export class OAuth {
  private attempts = new Map<string, Attempt>();
  constructor(readonly publisher: Publisher) {}
  start(account: Account, origin: string, direct = false) {
    const c = this.publisher.store.secrets[account.id] || {};
    if (!c.clientId || !c.clientSecret)
      throw new Error("Najpierw zapisz Client ID i Client Secret aplikacji.");
    const state = randomBytes(32).toString("hex"),
      verifier = randomBytes(48).toString("base64url");
    const redirect = c.redirectUri || `${origin}/api/publisher/oauth/callback`;
    if (!/^https?:\/\//.test(redirect))
      throw new Error("Nieprawidłowy adres powrotu OAuth.");
    for (const [key, value] of this.attempts)
      if (value.expires < Date.now()) this.attempts.delete(key);
    this.attempts.set(state, {
      accountId: account.id,
      verifier,
      redirect,
      expires: Date.now() + 10 * 60000,
    });
    const common = {
      client_id: c.clientId,
      redirect_uri: redirect,
      state,
      response_type: "code",
    };
    if (account.platform === "youtube")
      return `https://accounts.google.com/o/oauth2/v2/auth?${form({ ...common, scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", access_type: "offline", prompt: "consent", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })}`;
    if (account.platform === "tiktok")
      return `https://www.tiktok.com/v2/auth/authorize/?${form({ client_key: c.clientId, redirect_uri: redirect, state, response_type: "code", scope: direct ? "user.info.basic,video.publish,video.upload" : "user.info.basic,video.upload", code_challenge: createHash("sha256").update(verifier).digest("hex"), code_challenge_method: "S256" })}`;
    if (account.platform === "threads")
      return `https://threads.net/oauth/authorize?${form({ ...common, scope: "threads_basic,threads_content_publish" })}`;
    return `https://www.facebook.com/${c.apiVersion || "v23.0"}/dialog/oauth?${form({ ...common, scope: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish" })}`;
  }
  async finish(state: string, code: string) {
    const attempt = this.attempts.get(state);
    this.attempts.delete(state);
    if (!attempt || attempt.expires < Date.now() || !code)
      throw new Error(
        "Autoryzacja wygasła. Kliknij Połącz ponownie w aplikacji.",
      );
    const store = this.publisher.store,
      account = store.state.accounts.find((a) => a.id === attempt.accountId);
    if (!account) throw new Error("Konto zostało usunięte.");
    const c = store.secrets[account.id],
      fetcher = this.publisher.providers.fetcher;
    let result: any;
    if (account.platform === "youtube")
      result = await requestJson(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          body: form({
            client_id: c.clientId,
            client_secret: c.clientSecret,
            code,
            redirect_uri: attempt.redirect,
            grant_type: "authorization_code",
            code_verifier: attempt.verifier,
          }),
        },
        fetcher,
      );
    else if (account.platform === "tiktok")
      result = await requestJson(
        "https://open.tiktokapis.com/v2/oauth/token/",
        {
          method: "POST",
          body: form({
            client_key: c.clientId,
            client_secret: c.clientSecret,
            code,
            redirect_uri: attempt.redirect,
            grant_type: "authorization_code",
            code_verifier: attempt.verifier,
          }),
        },
        fetcher,
      );
    else if (account.platform === "threads") {
      const short = await requestJson(
        "https://graph.threads.net/oauth/access_token",
        {
          method: "POST",
          body: form({
            client_id: c.clientId,
            client_secret: c.clientSecret,
            code,
            redirect_uri: attempt.redirect,
            grant_type: "authorization_code",
          }),
        },
        fetcher,
      );
      result = await requestJson(
        `https://graph.threads.net/access_token?${form({ grant_type: "th_exchange_token", client_secret: c.clientSecret, access_token: short.access_token })}`,
        {},
        fetcher,
      );
      account.remoteId = String(short.user_id);
    } else {
      const graph = `https://graph.facebook.com/${c.apiVersion || "v23.0"}`;
      const short = await requestJson(
        `${graph}/oauth/access_token?${form({ client_id: c.clientId, client_secret: c.clientSecret, code, redirect_uri: attempt.redirect })}`,
        {},
        fetcher,
      );
      result = await requestJson(
        `${graph}/oauth/access_token?${form({ grant_type: "fb_exchange_token", client_id: c.clientId, client_secret: c.clientSecret, fb_exchange_token: short.access_token })}`,
        {},
        fetcher,
      );
      const pages = await requestJson(
        `${graph}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100`,
        { headers: bearer(result.access_token) },
        fetcher,
      );
      let count = 0;
      for (const page of pages.data || []) {
        const remote =
          account.platform === "instagram"
            ? page.instagram_business_account
            : page;
        if (!remote) continue;
        const existing = store.state.accounts.find(
          (a) => a.platform === account.platform && a.remoteId === remote.id,
        );
        const target =
          existing ||
          (count === 0 &&
          (!account.verifiedAt || account.remoteId === remote.id)
            ? account
            : {
                id: randomUUID(),
                platform: account.platform,
                name: "",
                remoteId: "",
                connected: false,
              });
        Object.assign(target, {
          name: remote.username || remote.name,
          remoteId: remote.id,
          connected: true,
          verifiedAt: new Date().toISOString(),
        });
        await store.exclusive(async () => {
          if (!store.state.accounts.includes(target))
            store.state.accounts.push(target);
          await store.saveSecret(target.id, {
            ...c,
            accessToken: page.access_token,
          });
          await store.save();
        });
        count++;
      }
      if (!count)
        throw new Error(
          "Nie znaleziono strony Facebook lub powiązanego profesjonalnego Instagrama. Sprawdź role i uprawnienia aplikacji.",
        );
      return;
    }
    if (!result.access_token)
      throw new Error("Platforma nie zwróciła tokenu dostępu.");
    await store.exclusive(async () => {
      await store.saveSecret(account.id, {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      });
      account.expiresAt = new Date(
        Date.now() + (result.expires_in || 3600) * 1000,
      ).toISOString();
      await store.save();
    });
    await this.publisher.providers.verify(account);
    await store.exclusive(() => store.save());
  }
}
