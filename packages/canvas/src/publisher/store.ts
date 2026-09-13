import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import type { Credentials, State } from "./model.js";

async function atomic(file: string, value: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, value, { mode: 0o600 });
  await rename(temp, file);
}

// DPAPI binds credentials to the current Windows user. Values only travel over stdin.
async function dpapi(value: string, decrypt: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const script = `Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); $b=[Convert]::FromBase64String($v); $r=[Security.Cryptography.ProtectedData]::${decrypt ? "Unprotect" : "Protect"}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (c) => {
      output += c;
    });
    child.stderr.resume();
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error("Nie udało się otworzyć magazynu kluczy Windows.")),
    );
    child.stdin.end(value);
  });
}

export class PublisherStore {
  state: State = { version: 1, assets: [], accounts: [], posts: [] };
  secrets: Record<string, Credentials> = {};
  readonly root: string;
  private tail: Promise<unknown> = Promise.resolve();
  private diskTail: Promise<unknown> = Promise.resolve();
  private ownsLock = false;
  constructor(workspace: string) {
    this.root = path.join(workspace, ".genius");
  }
  async initialize() {
    await mkdir(path.join(this.root, "media"), { recursive: true });
    const lock = path.join(this.root, "publisher.lock");
    try {
      await writeFile(lock, String(process.pid), { flag: "wx" });
      this.ownsLock = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(lock, "utf8"));
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (error) {
        alive = (error as NodeJS.ErrnoException).code === "EPERM";
      }
      if (alive || !Number.isInteger(pid) || pid <= 0)
        throw new Error(
          "Scheduler jest już uruchomiony dla tego projektu. Otwórz działającą aplikację.",
        );
      await rm(lock);
      await writeFile(lock, String(process.pid), { flag: "wx" });
      this.ownsLock = true;
    }
    try {
      const saved = JSON.parse(
        await readFile(path.join(this.root, "publisher.json"), "utf8"),
      );
      if (
        saved.version !== 1 ||
        !Array.isArray(saved.posts) ||
        !Array.isArray(saved.assets) ||
        !Array.isArray(saved.accounts)
      )
        throw new Error("Nieprawidłowy magazyn publikacji.");
      this.state = saved;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    try {
      const encrypted = await readFile(
        path.join(this.root, "credentials.enc"),
        "utf8",
      );
      let plain: string;
      if (encrypted.startsWith("dpapi:"))
        plain = Buffer.from(
          await dpapi(encrypted.slice(6), true),
          "base64",
        ).toString("utf8");
      else {
        const key = await readFile(path.join(this.root, "local.key"));
        const [iv, tag, data] = encrypted
          .split(":")
          .map((s) => Buffer.from(s, "base64"));
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        plain = Buffer.concat([
          decipher.update(data),
          decipher.final(),
        ]).toString("utf8");
      }
      this.secrets = JSON.parse(plain);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    // A crashed final POST has an unknown result. Never silently duplicate it.
    for (const post of this.state.posts) {
      for (const d of post.destinations)
        if (d.status === "publishing") {
          d.status = "needs_attention";
          d.error =
            "Aplikacja została zamknięta podczas wysyłki. Sprawdź konto przed ponowieniem.";
        }
      if (post.destinations.some((d) => d.status === "needs_attention"))
        post.status = "needs_attention";
    }
    await this.save();
  }
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => {});
    return next;
  }
  save() {
    const snapshot = JSON.stringify(this.state, null, 2);
    const next = this.diskTail.then(() =>
      atomic(path.join(this.root, "publisher.json"), snapshot),
    );
    this.diskTail = next.catch(() => {});
    return next;
  }
  async close() {
    await this.tail;
    await this.diskTail;
    if (this.ownsLock) {
      await rm(path.join(this.root, "publisher.lock"), { force: true });
      this.ownsLock = false;
    }
  }
  async saveSecret(id: string, credentials: Credentials) {
    this.secrets[id] = {
      ...this.secrets[id],
      ...Object.fromEntries(
        Object.entries(credentials).filter(([, v]) => v !== ""),
      ),
    };
    const plain = JSON.stringify(this.secrets);
    let encrypted: string;
    if (process.platform === "win32")
      encrypted =
        "dpapi:" + (await dpapi(Buffer.from(plain).toString("base64"), false));
    else {
      const keyFile = path.join(this.root, "local.key");
      let key = await readFile(keyFile).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== "ENOENT") throw e;
        return null;
      });
      if (!key) {
        key = randomBytes(32);
        await writeFile(keyFile, key, { mode: 0o600, flag: "wx" });
      }
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([cipher.update(plain), cipher.final()]);
      encrypted = [iv, cipher.getAuthTag(), data]
        .map((b) => b.toString("base64"))
        .join(":");
    }
    await atomic(path.join(this.root, "credentials.enc"), encrypted);
  }
  redact(message: string) {
    let result = message;
    for (const credentials of Object.values(this.secrets))
      for (const [key, value] of Object.entries(credentials))
        if (value && /token|secret|apiKey/i.test(key))
          result = result.split(value).join("[ukryto]");
    return result.replace(/https?:\/\/\S+/g, "[adres API]").slice(0, 800);
  }
}
