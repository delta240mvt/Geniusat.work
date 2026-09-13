#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base =
  process.env.GENIUS_URL ||
  `http://127.0.0.1:${process.env.CANVAS_PORT || 4188}`;
const [command = "help", ...args] = process.argv.slice(2);
const output = (value) => console.log(JSON.stringify(value, null, 2));
async function api(route, body) {
  const result = await fetch(
    `${base}/api/publisher/${route}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Genius-Local": "1",
          },
          body: JSON.stringify(body),
        },
  );
  const data = await result.json();
  if (!result.ok) throw new Error(data.error);
  return data;
}
async function input(file) {
  if (file === "-") {
    let value = "";
    for await (const chunk of process.stdin) value += chunk;
    return JSON.parse(value);
  }
  if (!file) throw new Error("Podaj plik JSON lub - (stdin).");
  return JSON.parse(await readFile(path.resolve(file), "utf8"));
}
try {
  if (command === "help")
    console.log(`GENIUS@WORK — lokalne studio i publikacje

npm.cmd run genius -- start                Uruchom studio i scheduler w tle
npm.cmd run genius -- stop                 Zakończ bieżącą wysyłkę i zatrzymaj aplikację
npm.cmd run genius -- status               Konta, materiały i kolejka (JSON)
npm.cmd run genius -- assets               Biblioteka mediów
npm.cmd run genius -- upload "film.mp4"     Dodaj dowolny lokalny plik
npm.cmd run genius -- import "apps/..."     Import ze studia
npm.cmd run genius -- create post.json      Zapisz szkic (zwraca ID i revision)
npm.cmd run genius -- validate post.json    Sprawdź zgodność z platformami
npm.cmd run genius -- schedule ID ISO-DATE  Zaplanuj istniejący szkic
npm.cmd run genius -- publish ID            Wyślij istniejący szkic teraz
npm.cmd run genius -- cancel ID             Anuluj zaplanowaną publikację
npm.cmd run genius -- retry ID              Ponów tylko nieudane wysyłki
npm.cmd run genius -- accounts              Konta, bez sekretów
npm.cmd run genius -- account -             Zapisz dane konta z JSON na stdin
npm.cmd run genius -- verify ACCOUNT-ID     Sprawdź token konta
npm.cmd run genius -- hosting -             Zapisz klucze hostingu z JSON na stdin

JSON publikacji: docs/examples/publication.json
Daty podawaj z offsetem, np. 2026-09-20T12:00:00+02:00.
Klucze przekazuj przez stdin lub lokalny plik *.local.json; nie przez argumenty.
Wysyłka nie jest symulacją. Polecenie publish/schedule używa połączonych kont.
`);
  else if (command === "start") {
    if (process.platform !== "win32")
      throw new Error("Na tym systemie użyj CANVAS_PORT=4188 npm run dev.");
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(root, "scripts/Start-Genius.ps1"),
        "-NoBrowser",
      ],
      { stdio: "inherit", windowsHide: true },
    );
    child.on("exit", (code) => {
      process.exitCode = code || 0;
    });
  } else if (command === "stop") output(await api("shutdown", {}));
  else if (command === "status") output(await api("state"));
  else if (command === "assets" || command === "accounts")
    output((await api("state"))[command]);
  else if (command === "create")
    output(await api("posts", await input(args[0])));
  else if (command === "validate")
    output(await api("validate", await input(args[0])));
  else if (command === "account")
    output(await api("accounts", await input(args[0])));
  else if (command === "hosting")
    output(await api("hosting", await input(args[0])));
  else if (command === "verify")
    output(await api(`accounts/${args[0]}/verify`, {}));
  else if (command === "import")
    output(await api("assets/import", { path: args[0] }));
  else if (command === "upload") {
    const file = path.resolve(args[0]);
    const result = await fetch(`${base}/api/publisher/assets/upload`, {
      method: "POST",
      headers: {
        "X-Genius-Local": "1",
        "X-File-Name": encodeURIComponent(path.basename(file)),
      },
      body: await openAsBlob(file),
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error);
    output(data);
  } else if (["schedule", "publish", "cancel", "retry"].includes(command)) {
    const post = (await api("state")).posts.find((p) => p.id === args[0]);
    if (!post) throw new Error("Publikacja nie istnieje.");
    output(
      await api(`posts/${post.id}/action`, {
        action: command,
        revision: post.revision,
        ...(command === "schedule" ? { scheduledAt: args[1] } : {}),
      }),
    );
  } else throw new Error("Nieznane polecenie. Użyj help.");
} catch (error) {
  console.error(
    error.cause?.code === "ECONNREFUSED"
      ? "Aplikacja nie działa. Uruchom: npm.cmd run genius -- start"
      : error.message,
  );
  process.exitCode = 1;
}
