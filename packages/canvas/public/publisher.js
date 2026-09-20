const names = {
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
};
const initials = {
  instagram: "IG",
  threads: "@",
  facebook: "f",
  tiktok: "Tk",
  youtube: "▶",
};
const statuses = {
  draft: "Szkic",
  scheduled: "Zaplanowano",
  pending: "W kolejce",
  publishing: "Wysyłanie",
  processing: "Przetwarzanie",
  published: "Opublikowano",
  failed: "Błąd wysyłki",
  partial: "Częściowo wysłano",
  needs_attention: "Sprawdź wynik na koncie",
  inbox: "Dokończ w TikToku",
  cancelled: "Anulowano",
};
const formats = {
  reel: "Rolka",
  carousel: "Karuzela",
  single: "Pojedynczy post",
};
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const timeText = (value) =>
  new Date(value).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const defaultOptions = {
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
};
let root,
  data,
  currentView = "calendar",
  currentWeek = new Date(),
  epoch = 0,
  timer,
  pendingStudio;
let cancelDrag,
  redrawPending = false;

// Pointer gestures also work in embedded browsers and on touch screens.
// Native HTML drops remain available for files dragged in from the desktop.
export function bindPointerDrag(card, targetSelector, drop) {
  card.draggable = false;
  let moved = false;
  card.addEventListener(
    "click",
    (event) => {
      if (moved) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  card.onpointerdown = (start) => {
    moved = false;
    if (
      start.button !== 0 ||
      (start.target.closest("button,input,a") &&
        start.target.closest("button,input,a") !== card)
    )
      return;
    cancelDrag?.();
    let target, ghost;
    const cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("keydown", escape);
      if (card.hasPointerCapture?.(start.pointerId))
        card.releasePointerCapture(start.pointerId);
      card.classList.remove("pub-dragging");
      target?.classList.remove("drag-over");
      ghost?.remove();
      cancelDrag = undefined;
    };
    const cancel = () => {
      cleanup();
    };
    const escape = (event) => {
      if (event.key === "Escape") cancel();
    };
    const move = (event) => {
      if (
        !moved &&
        Math.hypot(
          event.clientX - start.clientX,
          event.clientY - start.clientY,
        ) < 8
      )
        return;
      if (!moved) {
        moved = true;
        card.setPointerCapture?.(start.pointerId);
        card.classList.add("pub-dragging");
        ghost = document.createElement("div");
        ghost.className = "pub-drag-label";
        ghost.textContent =
          card.querySelector("strong")?.textContent || "Przesuń materiał";
        (card.closest("dialog") || document.body).append(ghost);
      }
      event.preventDefault();
      ghost.style.left = `${event.clientX + 14}px`;
      ghost.style.top = `${event.clientY + 14}px`;
      const hit = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(targetSelector);
      if (hit !== target) {
        target?.classList.remove("drag-over");
        target = hit;
        target?.classList.add("drag-over");
      }
    };
    const finish = (event) => {
      const destination = target;
      cleanup();
      if (moved) {
        event.preventDefault();
        if (destination && destination !== card)
          Promise.resolve(drop(destination)).catch((error) =>
            toast(error.message, true),
          );
      }
    };
    cancelDrag = cancel;
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", escape);
  };
}

async function placeOnDay(day, { assetId, postId, files = [] }) {
  if (postId) {
    const p = data.posts.find((p) => p.id === postId);
    if (!p) return;
    const previous = p.scheduledAt ? new Date(p.scheduledAt) : new Date();
    const next = new Date(
      `${day.dataset.day}T${String(previous.getHours()).padStart(2, "0")}:${String(previous.getMinutes()).padStart(2, "0")}`,
    );
    if (p.status === "scheduled") {
      await pubApi(`posts/${p.id}/action`, {
        action: "schedule",
        revision: p.revision,
        scheduledAt: next.toISOString(),
      });
      await refresh();
      toast("Termin zmieniony.");
    } else openComposer({ ...p, scheduledAt: next.toISOString() });
    return;
  }
  const assets = assetId
    ? [data.assets.find((a) => a.id === assetId)].filter(Boolean)
    : await uploadFiles(files);
  if (assets.length)
    openComposer({
      scheduledAt: `${day.dataset.day}T12:00`,
      assetIds: assets.map((a) => a.id),
      title: assets[0].name.replace(/\.[^.]+$/, ""),
      format:
        assets.length > 1
          ? "carousel"
          : assets[0].type === "video"
            ? "reel"
            : "single",
    });
}

export async function pubApi(route, body) {
  const response = await fetch(
    `/api/publisher/${route}`,
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
  const result = await response
    .json()
    .catch(() => ({ error: "Serwer nie odpowiedział poprawnie." }));
  if (!response.ok)
    throw new Error(result.error || "Nie udało się wykonać operacji.");
  return result;
}
function toast(message, error = false) {
  let element = document.querySelector("#publisher-toast");
  if (!element) {
    element = document.createElement("div");
    element.id = "publisher-toast";
    element.setAttribute("role", "status");
    document.body.append(element);
  }
  const host =
    [...document.querySelectorAll("dialog[open]")].at(-1) || document.body;
  host.append(element);
  element.className = `pub-toast${error ? " error" : ""}`;
  element.textContent = message;
  element.hidden = false;
  clearTimeout(element.hideTimer);
  element.hideTimer = setTimeout(
    () => {
      element.hidden = true;
    },
    error ? 12000 : 5000,
  );
}
async function task(button, fn) {
  if (button?.disabled) return;
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Chwila…";
  }
  try {
    return await fn();
  } catch (error) {
    toast(error.message, true);
    throw error;
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}
function bindTask(button, fn) {
  if (button)
    button.onclick = () => {
      void task(button, fn).catch(() => {});
    };
}
function icon(platform) {
  return `<span class="pub-platform-icon ${platform}" aria-hidden="true">${initials[platform]}</span>`;
}
function assetImage(asset, controls = false) {
  const src = `/api/publisher/media/${asset.id}`;
  return asset.type === "video"
    ? `<video src="${src}#t=0.5" ${controls ? "controls" : "muted"} playsinline preload="metadata" aria-label="${esc(asset.name)}"></video>`
    : `<img src="${src}" alt="${esc(asset.name)}" loading="lazy">`;
}
function modal(title, wide = false) {
  const dialog = document.createElement("dialog");
  dialog.className = `pub-dialog${wide ? " wide" : ""}`;
  dialog.innerHTML = `<header class="pub-dialog-head"><h2>${esc(title)}</h2><button type="button" class="pub-icon-button" aria-label="Zamknij">×</button></header><div class="pub-dialog-body"></div>`;
  const titleId = `pub-dialog-${crypto.randomUUID()}`;
  dialog.querySelector("h2").id = titleId;
  dialog.setAttribute("aria-labelledby", titleId);
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector("header button").onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove());
  return dialog;
}
export function openStudioPublication(detail) {
  pendingStudio = detail;
}
export function unmountPublisher() {
  cancelDrag?.();
  epoch++;
  clearTimeout(timer);
  root = null;
  document.querySelectorAll(".pub-dialog").forEach((d) => d.close());
}
export async function mountPublisher(target, view) {
  unmountPublisher();
  root = target;
  if (view) currentView = view;
  const requestEpoch = epoch;
  target.innerHTML = '<p class="empty-state">Wczytuję plan publikacji…</p>';
  try {
    data = await pubApi("state");
    if (requestEpoch !== epoch) return;
    draw();
    poll(requestEpoch);
    if (pendingStudio) {
      const detail = pendingStudio;
      pendingStudio = null;
      const asset = await pubApi("assets/import", { path: detail.path });
      data = await pubApi("state");
      if (requestEpoch !== epoch) return;
      openComposer({
        title: detail.title,
        format: asset.type === "video" ? "reel" : "single",
        assetIds: [asset.id],
      });
    }
  } catch (error) {
    if (requestEpoch === epoch) {
      target.innerHTML = `<div class="empty-state"><h2>Nie udało się wczytać publikacji</h2><p>${esc(error.message)}</p><button class="btn" id="pub-retry-load">Spróbuj ponownie</button></div>`;
      bindTask(target.querySelector("#pub-retry-load"), () =>
        mountPublisher(target),
      );
    }
  }
}
function poll(requestEpoch) {
  timer = setTimeout(async () => {
    try {
      const fresh = await pubApi("state");
      if (requestEpoch !== epoch) return;
      const changed =
        JSON.stringify([data.posts, data.accounts]) !==
        JSON.stringify([fresh.posts, fresh.accounts]);
      data = fresh;
      redrawPending ||= changed;
      if (
        redrawPending &&
        !cancelDrag &&
        !document.querySelector(".pub-dialog")
      )
        draw();
    } catch {
      /* Current view stays usable during a temporary disconnect. */
    }
    if (requestEpoch === epoch) poll(requestEpoch);
  }, 5000);
}
async function refresh() {
  data = await pubApi("state");
  if (root) draw();
}

function draw() {
  if (!root) return;
  redrawPending = false;
  const connected = data.accounts.filter((a) => a.connected).length;
  const queued = data.posts.filter((p) => p.status === "scheduled").length;
  root.innerHTML = `<section class="publisher"><header class="pub-heading"><div><div class="pub-eyebrow">GENIUS@WORK / PUBLIKACJE</div><h1>Plan publikacji</h1><p>Rolki, karuzele i posty. Wybierz materiał, konta i termin.</p></div><div class="pub-heading-actions"><button class="btn accent" id="pub-new">＋ Nowa publikacja</button><button class="pub-text-button" id="pub-connections">${connected ? `${connected} połączonych kont` : "○ Połącz pierwsze konto"} <span aria-hidden="true">↗</span></button></div></header>
  <nav class="pub-tabs" aria-label="Publikacje">${[
    ["calendar", "Kalendarz"],
    ["list", `Kolejka${queued ? ` · ${queued}` : ""}`],
    ["library", "Biblioteka"],
    ["accounts", "Konta i klucze"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" data-view="${id}" ${currentView === id ? 'aria-current="page"' : ""}>${label}</button>`,
    )
    .join("")}</nav>
  <div class="pub-view">${currentView === "calendar" ? calendarMarkup() : currentView === "list" ? listMarkup() : currentView === "library" ? libraryMarkup() : accountsMarkup()}</div>
  <footer class="pub-footnote"><span class="pub-live-dot"></span> Scheduler działa lokalnie, także po zamknięciu karty. Komputer i aplikacja muszą pozostać uruchomione.</footer></section>`;
  root.querySelectorAll("[data-view]").forEach(
    (button) =>
      (button.onclick = () => {
        currentView = button.dataset.view;
        draw();
      }),
  );
  root.querySelector("#pub-new").onclick = () => openComposer();
  root.querySelector("#pub-connections").onclick = () => {
    currentView = "accounts";
    draw();
  };
  root.querySelectorAll("[data-open-post]").forEach((button) => {
    button.onclick = () =>
      openPost(data.posts.find((p) => p.id === button.dataset.openPost));
    button.ondragstart = (event) => {
      event.dataTransfer.setData(
        "application/x-genius-post",
        button.dataset.openPost,
      );
      event.dataTransfer.effectAllowed = "move";
    };
    if (
      ["draft", "scheduled"].includes(
        data.posts.find((p) => p.id === button.dataset.openPost)?.status,
      )
    )
      bindPointerDrag(button, "[data-day]", (day) =>
        placeOnDay(day, { postId: button.dataset.openPost }),
      );
  });
  root
    .querySelectorAll("[data-new-day]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          openComposer({ scheduledAt: `${button.dataset.newDay}T12:00` })),
    );
  root.querySelectorAll("[data-day]").forEach((day) => {
    day.ondragover = (event) => {
      event.preventDefault();
      day.classList.add("drag-over");
    };
    day.ondragleave = () => day.classList.remove("drag-over");
    day.ondrop = async (event) => {
      event.preventDefault();
      day.classList.remove("drag-over");
      try {
        await placeOnDay(day, {
          assetId: event.dataTransfer.getData("application/x-genius-asset"),
          postId: event.dataTransfer.getData("application/x-genius-post"),
          files: event.dataTransfer.files,
        });
      } catch (error) {
        toast(error.message, true);
      }
    };
  });
  root.querySelectorAll("[data-asset]").forEach((card) => {
    card.ondragstart = (event) => {
      event.dataTransfer.setData(
        "application/x-genius-asset",
        card.dataset.asset,
      );
      event.dataTransfer.effectAllowed = "copy";
    };
    bindPointerDrag(card, "[data-day]", (day) =>
      placeOnDay(day, { assetId: card.dataset.asset }),
    );
    card.querySelector("button").onclick = () => {
      const a = data.assets.find((a) => a.id === card.dataset.asset);
      openComposer({
        title: a.name.replace(/\.[^.]+$/, ""),
        format: a.type === "video" ? "reel" : "single",
        assetIds: [a.id],
      });
    };
  });
  root.querySelectorAll("[data-week]").forEach(
    (button) =>
      (button.onclick = () => {
        if (button.dataset.week === "today") currentWeek = new Date();
        else
          currentWeek.setDate(
            currentWeek.getDate() + Number(button.dataset.week) * 7,
          );
        draw();
      }),
  );
  bindTask(root.querySelector("#pub-upload"), () => chooseUpload());
  bindTask(root.querySelector("#pub-studio-library"), () => studioLibrary());
  root
    .querySelectorAll("[data-add-account]")
    .forEach(
      (button) =>
        (button.onclick = () => accountDialog(button.dataset.addAccount)),
    );
  root
    .querySelectorAll("[data-edit-account]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          accountDialog(
            data.accounts.find((a) => a.id === button.dataset.editAccount)
              .platform,
            button.dataset.editAccount,
          )),
    );
  root.querySelector("#pub-hosting")?.addEventListener("click", hostingDialog);
  root.querySelector("#pub-local-health")?.addEventListener("click", () => {
    void import("./configuration.js").then((m) => m.showConfiguration());
  });
  const composioPanel = root.querySelector("#composio-settings");
  if (composioPanel) void renderComposioSettings(composioPanel);
  const shelf = root.querySelector(".pub-upload-zone");
  if (shelf) {
    shelf.ondragover = (event) => {
      event.preventDefault();
      shelf.classList.add("drag-over");
    };
    shelf.ondragleave = () => shelf.classList.remove("drag-over");
    shelf.ondrop = async (event) => {
      event.preventDefault();
      shelf.classList.remove("drag-over");
      try {
        await uploadFiles(event.dataTransfer.files);
        await refresh();
      } catch (error) {
        toast(error.message, true);
      }
    };
  }
}
function calendarMarkup() {
  const start = new Date(currentWeek);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const range = `${days[0].toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} — ${days[6].toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}`;
  return `<div class="pub-section-heading"><div><h2>${range}</h2><p>Przeciągnij materiał na dzień lub kliknij ＋. Godziny: ${esc(data.timezone)}.</p></div><div class="pub-calendar-nav"><button class="pub-icon-button" data-week="-1" aria-label="Poprzedni tydzień">←</button><button class="pub-text-button" data-week="today">Dzisiaj</button><button class="pub-icon-button" data-week="1" aria-label="Następny tydzień">→</button></div></div>
  <div class="pub-calendar-scroll"><div class="pub-calendar">${days
    .map((d) => {
      const key = dateKey(d),
        today = key === dateKey(new Date());
      const posts = data.posts
        .filter(
          (p) =>
            p.scheduledAt &&
            dateKey(new Date(p.scheduledAt)) === key &&
            p.status !== "cancelled",
        )
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      return `<section class="pub-day${today ? " today" : ""}" data-day="${key}" aria-label="${d.toLocaleDateString("pl-PL")}"><header><span>${d.toLocaleDateString("pl-PL", { weekday: "short" })}</span><strong>${d.getDate()}</strong></header><div class="pub-day-posts">${posts.map((p) => postCard(p)).join("")}</div><button class="pub-day-add" data-new-day="${key}" aria-label="Nowa publikacja ${d.toLocaleDateString("pl-PL")}">＋<span>Dodaj treść</span></button></section>`;
    })
    .join("")}</div></div>
  <div class="pub-section-heading shelf-heading"><div><h2>Gotowe materiały</h2><p>Ze studia prosto do kalendarza.</p></div><button class="pub-text-button" data-view="library">Cała biblioteka ↗</button></div>${assetGrid(data.assets.slice(0, 6), true)}`;
}
function postCard(post) {
  return `<button class="pub-post-card" draggable="${post.status === "scheduled" || post.status === "draft"}" data-open-post="${post.id}"><span class="pub-status ${post.status}">${statuses[post.status]}</span><strong>${esc(post.title)}</strong><span class="pub-post-icons">${post.accountIds
    .map((id) => data.accounts.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => icon(a.platform))
    .join(
      "",
    )}<time>${post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : "Szkic"}</time></span></button>`;
}
function listMarkup() {
  if (!data.posts.length)
    return '<div class="pub-empty"><span aria-hidden="true">↗</span><h2>Twój pierwszy post zaczyna się tutaj.</h2><p>Dodaj materiał, wybierz konta i ustal termin.<br>Szkic możesz zapisać jeszcze przed podłączeniem kont.</p></div>';
  return `<div class="pub-section-heading"><div><h2>Wszystkie publikacje</h2><p>Szkice, zaplanowane treści i wyniki wysyłki.</p></div><span>Publikacje: ${data.posts.length}</span></div><div class="pub-post-list">${data.posts
    .map(
      (p) =>
        `<button data-open-post="${p.id}" class="pub-list-row"><span class="pub-status ${p.status}">${statuses[p.status]}</span><div><strong>${esc(p.title)}</strong><p>${formats[p.format]} · ${p.scheduledAt ? timeText(p.scheduledAt) : "Bez terminu"}</p></div><span class="pub-post-icons">${p.accountIds
          .map((id) => data.accounts.find((a) => a.id === id))
          .filter(Boolean)
          .map((a) => icon(a.platform))
          .join("")}</span><span aria-hidden="true">↗</span></button>`,
    )
    .join("")}</div>`;
}
function assetGrid(assets, compact = false) {
  if (!assets.length)
    return '<div class="pub-empty compact"><h3>Twoje materiały pojawią się tutaj.</h3><p>Otwórz Bibliotekę, dodaj pliki lub wybierz eksport ze studia rolek.</p></div>';
  return `<div class="pub-asset-grid${compact ? " compact" : ""}">${assets.map((a) => `<article class="pub-asset-card" draggable="true" data-asset="${a.id}"><div class="pub-asset-preview">${assetImage(a)}<span>${a.type === "video" ? "WIDEO" : "ZDJĘCIE"}</span></div><div class="pub-asset-info"><strong title="${esc(a.name)}">${esc(a.name)}</strong><span>${a.width} × ${a.height} · ${(a.bytes / 1024 / 1024).toFixed(1)} MB</span><button class="pub-text-button" type="button">Utwórz publikację ↗</button></div></article>`).join("")}</div>`;
}
function libraryMarkup() {
  return `<div class="pub-section-heading"><div><h2>Biblioteka treści</h2><p>Rolki i zdjęcia w jednym miejscu. Przeciągnij je do publikacji.</p></div><button class="btn" id="pub-studio-library">Wybierz ze studia ↗</button></div><div class="pub-upload-zone"><span aria-hidden="true">＋</span><div><strong>Przeciągnij pliki tutaj</strong><p>MP4, MOV, JPG, PNG, WebP · do 2 GB na plik</p></div><button class="btn" id="pub-upload">Wybierz z dysku</button></div>${assetGrid(data.assets)}`;
}

async function renderComposioSettings(target) {
  target.innerHTML = '<span class="pub-eyebrow">COMPOSIO.DEV</span><h2>Połącz aplikacje bez tworzenia osobnych kont developerskich</h2><p>Łączenia OAuth i tokeny są przechowywane przez Composio. Genius@Scale pokazuje tylko aktualnie wykryte akcje publikacyjne.</p><p class="pub-inline-result">Wczytuję katalog możliwości…</p>';
  try {
    const [catalog, connections] = await Promise.all([
      pubApi("composio/capabilities"),
      pubApi("composio/connections"),
    ]);
    if (!target.isConnected) return;
    const connectionByToolkit = new Map((connections.connections || []).map((item) => [item.toolkitSlug, item]));
    const rows = (catalog.capabilities || []).map((capability) => {
      const connection = connectionByToolkit.get(capability.toolkitSlug);
      const label = connection?.displayName || connection?.alias || (connection ? "Połączono" : "Niepołączone");
      const button = connection?.status === "ACTIVE"
        ? `<span class="pub-connection-state connected">● ${esc(label)}</span>`
        : capability.authConfigId
          ? `<button class="pub-text-button" data-composio-connect="${esc(capability.authConfigId)}">Połącz ${esc(capability.toolkitName)} ↗</button>`
          : '<span class="pub-connection-state">Brak auth config</span>';
      return `<article class="pub-composio-row"><div><strong>${esc(capability.toolkitName)}</strong><small>${esc(capability.actionName)} · ${esc(capability.description)}</small></div>${button}</article>`;
    }).join("");
    target.innerHTML = `<span class="pub-eyebrow">COMPOSIO.DEV · GŁÓWNE POŁĄCZENIA</span><h2>Połącz aplikacje bez osobnych kont developerskich</h2><p>Łączenia OAuth i tokeny są przechowywane przez Composio. Poniżej pojawiają się wyłącznie wykryte akcje publikacyjne.</p>${catalog.configured ? rows || '<p class="pub-inline-result">Brak wykrytej akcji publikacyjnej w bieżącym katalogu.</p>' : `<p class="pub-inline-result">${esc(catalog.error || "Ustaw COMPOSIO_API_KEY w środowisku aplikacji.")}</p>`}`;
    target.querySelectorAll("[data-composio-connect]").forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          const result = await pubApi("composio/connect", {authConfigId: button.dataset.composioConnect});
          window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
          toast(error.message, true);
        } finally {
          button.disabled = false;
        }
      };
    });
  } catch (error) {
    if (target.isConnected) target.innerHTML = `<span class="pub-eyebrow">COMPOSIO.DEV</span><h2>Połączenia Composio</h2><p class="pub-inline-result">${esc(error.message)}</p>`;
  }
}

function accountsMarkup() {
  return `<section id="composio-settings" class="pub-composio-panel"></section><div class="pub-section-heading"><div><h2>Połączenia natywne</h2><p>Istniejące połączenia platform pozostają dostępne jako tryb zgodności.</p></div></div><div class="pub-account-grid" id="pub-native-accounts">${Object.entries(
    names,
  )
    .map(([p, name]) => {
      const accounts = data.accounts.filter((a) => a.platform === p);
      return `<section class="pub-account-card"><header>${icon(p)}<h3>${name}</h3></header><p>${p === "instagram" ? "Profesjonalne konto połączone ze stroną Facebook. Rolki, zdjęcia i karuzele." : p === "threads" ? "Tekst, zdjęcia, filmy i karuzele na Twoim profilu." : p === "facebook" ? "Publikacje na stronach: rolki, tekst, zdjęcia i albumy." : p === "tiktok" ? "Filmy i zdjęcia. Direct Post lub wysyłka do aplikacji TikTok." : "Pionowe filmy do 3 minut. Autoryzacja Google OAuth."}</p>${accounts.map((a) => `<button class="pub-connected-account" data-edit-account="${a.id}"><span class="${a.connected ? "connected" : ""}">${a.connected ? "●" : "○"}</span><strong>${esc(a.name)}</strong><small>${a.connected ? "Połączono" : "Dokończ konfigurację"}</small><span>↗</span></button>`).join("")}<button class="pub-text-button" data-add-account="${p}">＋ ${accounts.length ? "Dodaj konto" : "Połącz " + name}</button></section>`;
    })
    .join(
      "",
    )}</div><div class="pub-settings-extra" id="pub-settings-extra"><section><span class="pub-eyebrow">PUBLICZNE PLIKI</span><h3>Hosting mediów</h3><p>Instagram i Threads pobierają materiały z internetu. Cloudflare R2 udostępnia wybrane pliki. Możesz użyć istniejącej sesji Wrangler bez wklejania kluczy, a także wysłać plik weryfikacji TikToka.</p><button class="btn" id="pub-hosting">${data.hosting.configured ? "✓ Hosting skonfigurowany · Edytuj" : "Skonfiguruj hosting"}</button></section><section><span class="pub-eyebrow">NA TWOIM KOMPUTERZE</span><h3>Studio i terminal</h3><p>Ikona GENIUS@WORK uruchamia studio i scheduler. AI może sterować publikacjami przez <code>npm.cmd run genius -- help</code>.</p><button class="btn" id="pub-local-health">Sprawdź lokalne narzędzia</button></section></div><p class="pub-setup-note">Dostęp do publicznych publikacji zależy od uprawnień i weryfikacji aplikacji przez platformę. TikTok nie akceptuje Direct Post dla narzędzi przeznaczonych wyłącznie do własnych kont; tryb „Dokończ w TikToku” wymaga ostatniego kroku w jego aplikacji. Nowe, niezweryfikowane projekty YouTube publikują prywatnie.</p>`;
}

async function uploadFiles(files) {
  const results = [];
  for (const file of files) {
    if (file.size > 2 * 1024 ** 3)
      throw new Error("Maksymalny rozmiar pliku to 2 GB.");
    if (!/\.(mp4|mov|jpe?g|png|webp)$/i.test(file.name))
      throw new Error("Dodaj MP4, MOV, JPG, PNG lub WebP.");
    toast(`Dodaję ${file.name}…`);
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/publisher/assets/upload");
      xhr.setRequestHeader("X-Genius-Local", "1");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          toast(
            `${file.name} · ${Math.round((e.loaded / e.total) * 100)}%${e.loaded === e.total ? " · przygotowuję plik…" : ""}`,
          );
      };
      xhr.onload = () => {
        let value;
        try {
          value = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error("Przesyłanie przerwane. Spróbuj ponownie."));
          return;
        }
        xhr.status < 300 ? resolve(value) : reject(new Error(value.error));
      };
      xhr.onerror = () => reject(new Error("Brak połączenia z aplikacją."));
      xhr.send(file);
    });
    results.push(result);
  }
  data = await pubApi("state");
  toast(
    `Dodano ${results.length} ${results.length === 1 ? "materiał" : "materiały"}.`,
  );
  return results;
}
function chooseUpload(onComplete) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "video/mp4,video/quicktime,image/jpeg,image/png,image/webp";
  input.onchange = async () => {
    try {
      const added = await uploadFiles(input.files);
      if (onComplete) onComplete(added);
      else await refresh();
    } catch (error) {
      toast(error.message, true);
    }
  };
  input.click();
}
async function studioLibrary(onPick) {
  const dialog = modal("Materiały ze studia", true),
    content = dialog.querySelector(".pub-dialog-body");
  content.innerHTML = "<p>Wczytuję eksporty i materiały…</p>";
  const library = await pubApi("library");
  if (!dialog.isConnected) return;
  const outputs = library.reels.flatMap((r) =>
    r.outputs
      .filter((o) => !o.stale)
      .map((o) => ({
        name: `${r.title} · ${o.engine}`,
        path: decodeURIComponent(o.url.slice("/api/workspace/".length)),
        type: "video",
        title: r.title,
      })),
  );
  const seen = new Set(outputs.map((a) => a.path));
  const items = [
    ...outputs,
    ...library.assets.filter((a) => !seen.has(a.path)),
  ];
  content.innerHTML = `<p>Gotowe eksporty są na górze. Pozostałe pliki znajdziesz po nazwie.</p><label class="pub-field">Szukaj materiału<input type="search" id="studio-search" placeholder="Tytuł rolki lub nazwa pliku"></label><div class="pub-studio-list"></div><button type="button" class="pub-text-button" id="studio-show-all">Pokaż pozostałe materiały (${items.length})</button>`;
  let expanded = false;
  function showItems() {
    const query = content
      .querySelector("#studio-search")
      .value.toLocaleLowerCase("pl");
    const filtered = items
      .map((a, i) => ({ ...a, index: i }))
      .filter((a) => !query || a.name.toLocaleLowerCase("pl").includes(query));
    const visible = filtered.slice(
      0,
      query || expanded ? 40 : Math.max(outputs.length, 6),
    );
    content.querySelector(".pub-studio-list").innerHTML =
      visible
        .map(
          (a) =>
            `<button class="pub-studio-item" data-pick="${a.index}"><span>${/\.(mp4|mov)$/i.test(a.path) ? "▶" : "▧"}</span><div><strong>${esc(a.name)}</strong><small>${a.title ? "Gotowy eksport ze studia rolek" : a.path.includes("ai-studio") ? "AI Studio · obraz" : "Biblioteka materiałów"}</small></div><span>＋ Dodaj</span></button>`,
        )
        .join("") || "<p>Nie znaleziono materiałów.</p>";
    content.querySelectorAll("[data-pick]").forEach((button) =>
      bindTask(button, async () => {
        const item = items[Number(button.dataset.pick)];
        const asset = await pubApi("assets/import", { path: item.path });
        data = await pubApi("state");
        dialog.close();
        if (onPick) onPick([asset]);
        else {
          draw();
          toast("Materiał dodany do biblioteki.");
        }
      }),
    );
    content.querySelector("#studio-show-all").hidden =
      expanded || Boolean(query) || items.length <= visible.length;
  }
  content.querySelector("#studio-search").oninput = showItems;
  content.querySelector("#studio-show-all").onclick = () => {
    expanded = true;
    showItems();
  };
  showItems();
}

function openComposer(initial = {}) {
  if (!Object.keys(initial).length) {
    try {
      initial =
        JSON.parse(sessionStorage.getItem("genius:publication-draft")) || {};
    } catch {}
  }
  const post = {
    title: "",
    caption: "",
    format: "reel",
    assetIds: [],
    accountIds: [],
    scheduledAt: null,
    options: { ...defaultOptions },
    ...structuredClone(initial),
  };
  post.options = { ...defaultOptions, ...initial.options };
  const dialog = modal(post.id ? "Edytuj publikację" : "Nowa publikacja", true),
    content = dialog.querySelector(".pub-dialog-body");
  let validationId = 0,
    validating = false,
    issues = [],
    saving = false;
  const scheduled = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const localDate =
    scheduled && Number.isFinite(scheduled.getTime())
      ? `${dateKey(scheduled)}T${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}`
      : "";
  content.innerHTML = `<form class="pub-composer"><div class="pub-compose-fields"><fieldset><legend>1. Treść</legend><div class="pub-format-switch">${Object.entries(
    formats,
  )
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="format" value="${value}" ${post.format === value ? "checked" : ""}><span>${label}</span></label>`,
    )
    .join(
      "",
    )}</div></fieldset><label class="pub-field">Tytuł roboczy / tytuł Shorts<input name="title" maxlength="100" required value="${esc(post.title)}" placeholder="O czym jest ta publikacja?"></label><label class="pub-field">Opis<textarea name="caption" rows="5" maxlength="5000" placeholder="Napisz treść posta. Możesz dodać hashtagi.">${esc(post.caption)}</textarea><span class="pub-char-count">${post.caption.length} znaków</span></label>
  <div class="pub-composer-drop"><strong>Przeciągnij zdjęcia lub film</strong><span>Przesuń miniatury, aby ustawić kolejność karuzeli.</span><div><button type="button" class="pub-text-button" id="compose-upload">Z dysku</button><button type="button" class="pub-text-button" id="compose-library">Z biblioteki</button><button type="button" class="pub-text-button" id="compose-studio">Ze studia</button></div></div><div id="compose-assets" class="pub-compose-assets"></div><div id="compose-library-picker" hidden></div>
  <fieldset><legend>2. Gdzie publikujemy?</legend><div class="pub-account-choices">${Object.entries(
    names,
  )
    .map(([platform, name]) => {
      const accounts = data.accounts.filter((a) => a.platform === platform);
      return accounts.length
        ? accounts
            .map(
              (a) =>
                `<label class="pub-account-choice"><input type="checkbox" name="accounts" value="${a.id}" ${post.accountIds.includes(a.id) ? "checked" : ""}>${icon(platform)}<span><strong>${esc(a.name)}</strong><small>${name}${a.connected ? "" : " · niepołączone"}</small></span></label>`,
            )
            .join("")
        : `<button type="button" class="pub-account-choice missing" data-connect="${platform}">${icon(platform)}<span>${name}<small>＋ Połącz konto</small></span></button>`;
    })
    .join("")}</div></fieldset><div id="platform-options"></div>
  <fieldset><legend>3. Kiedy?</legend><div class="pub-format-switch"><label><input type="radio" name="timing" value="now" ${!localDate ? "checked" : ""}><span>Teraz</span></label><label><input type="radio" name="timing" value="later" ${localDate ? "checked" : ""}><span>Wybierz termin</span></label></div><label class="pub-field" id="compose-date-field" ${!localDate ? "hidden" : ""}>Data i godzina · ${esc(data.timezone)}<input type="datetime-local" name="scheduledAt" value="${localDate}"></label></fieldset>
  <div id="compose-issues" class="pub-validation" role="status"></div><div class="pub-composer-actions"><button class="btn" type="button" id="compose-save">Zapisz szkic</button><button class="btn accent" type="submit" id="compose-publish">${localDate ? "Zaplanuj publikację" : "Opublikuj teraz"} ↗</button></div></div>
  <aside class="pub-compose-preview"><span class="pub-eyebrow">PODGLĄD TREŚCI</span><div class="pub-phone"><header><span class="pub-avatar">G</span><strong>GENIUS@WORK</strong><span>•••</span></header><div id="compose-preview-media"></div><p id="compose-preview-caption"></p></div><p class="pub-preview-note">Podgląd materiału. Każda platforma ma własny układ i kadrowanie.</p></aside></form>`;
  const form = content.querySelector("form");
  function collect() {
    const values = new FormData(form);
    post.title = String(values.get("title"));
    post.caption = String(values.get("caption"));
    post.format = String(values.get("format"));
    post.accountIds = values.getAll("accounts").map(String);
    const dateValue = String(values.get("scheduledAt") || "");
    post.scheduledAt =
      values.get("timing") === "later" &&
      dateValue &&
      Number.isFinite(new Date(dateValue).getTime())
        ? new Date(dateValue).toISOString()
        : null;
    try {
      sessionStorage.setItem("genius:publication-draft", JSON.stringify(post));
    } catch {}
    return post;
  }
  function optionsMarkup() {
    const platforms = post.accountIds.map(
      (id) => data.accounts.find((a) => a.id === id)?.platform,
    );
    const target = content.querySelector("#platform-options");
    target.innerHTML = `${
      platforms.includes("youtube")
        ? `<fieldset class="pub-platform-settings"><legend>YouTube Shorts</legend><label class="pub-field">Widoczność<select name="youtubePrivacy">${[
            ["private", "Prywatny"],
            ["unlisted", "Niepubliczny"],
            ["public", "Publiczny"],
          ]
            .map(
              ([v, l]) =>
                `<option value="${v}" ${post.options.youtubePrivacy === v ? "selected" : ""}>${l}</option>`,
            )
            .join(
              "",
            )}</select></label><label class="pub-check"><input type="checkbox" name="madeForKids" ${post.options.madeForKids ? "checked" : ""}>Materiał przeznaczony dla dzieci</label></fieldset>`
        : ""
    }
    ${
      platforms.includes("tiktok")
        ? `<fieldset class="pub-platform-settings"><legend>TikTok</legend><label class="pub-field">Sposób wysyłki<select name="tiktokMode"><option value="inbox" ${post.options.tiktokMode === "inbox" ? "selected" : ""}>Dokończ w aplikacji TikTok</option><option value="direct" ${post.options.tiktokMode === "direct" ? "selected" : ""}>Direct Post — zatwierdzona aplikacja</option></select></label>${
            post.options.tiktokMode === "direct"
              ? `<p>Widoczność musi pochodzić z aktualnych ustawień konta.</p><button type="button" class="btn" id="load-tiktok">Pobierz opcje konta</button><label class="pub-field">Widoczność<select name="tiktokPrivacy"><option value="">Wybierz widoczność…</option>${[
                  ...new Set(
                    post.accountIds
                      .map((id) => data.accounts.find((a) => a.id === id))
                      .filter((a) => a?.platform === "tiktok")
                      .flatMap((a) => a.creator?.privacy_level_options || []),
                  ),
                ]
                  .map(
                    (v) =>
                      `<option value="${esc(v)}" ${post.options.tiktokPrivacy === v ? "selected" : ""}>${{ PUBLIC_TO_EVERYONE: "Publiczna", MUTUAL_FOLLOW_FRIENDS: "Znajomi", FOLLOWER_OF_CREATOR: "Obserwujący", SELF_ONLY: "Tylko ja" }[v] || esc(v)}</option>`,
                  )
                  .join("")}</select></label>${[
                  ["allowComments", "Zezwól na komentarze"],
                  ["allowDuet", "Zezwól na Duet"],
                  ["allowStitch", "Zezwól na Stitch"],
                  ["ownBrand", "Promuję własną markę"],
                  ["brandedContent", "Płatna współpraca / marka partnera"],
                  ["aiGenerated", "Treść wygenerowana przez AI"],
                ]
                  .map(
                    ([key, label]) =>
                      `<label class="pub-check"><input type="checkbox" name="${key}" ${post.options[key] ? "checked" : ""}>${label}</label>`,
                  )
                  .join("")}`
              : "<p>Film trafi do skrzynki TikToka. Otrzymasz powiadomienie i dokończysz publikację w jego aplikacji.</p>"
          }<label class="pub-check consent"><input type="checkbox" name="tiktokConsent" ${post.options.tiktokConsent ? "checked" : ""}>Zgadzam się na wysłanie tej treści do wybranych kont TikTok. Akceptuję <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Music Usage Confirmation</a>${post.options.brandedContent || post.options.ownBrand ? " i zasady treści komercyjnych TikTok" : ""}.</label></fieldset>`
        : ""
    }`;
    target.querySelectorAll("select,input").forEach(
      (input) =>
        (input.onchange = () => {
          post.options[input.name] =
            input.type === "checkbox" ? input.checked : input.value;
          if (["tiktokMode", "ownBrand", "brandedContent"].includes(input.name))
            optionsMarkup();
          void validate();
        }),
    );
    bindTask(target.querySelector("#load-tiktok"), async () => {
      for (const id of post.accountIds) {
        const a = data.accounts.find((a) => a.id === id);
        if (a?.platform === "tiktok")
          a.creator = await pubApi(`accounts/${id}/creator`, {});
      }
      optionsMarkup();
      toast("Opcje TikToka zostały odświeżone.");
    });
  }
  function drawAssets() {
    const assets = post.assetIds
      .map((id) => data.assets.find((a) => a.id === id))
      .filter(Boolean);
    content.querySelector("#compose-assets").innerHTML = assets
      .map(
        (a, index) =>
          `<div draggable="true" data-order="${index}" class="pub-compose-asset">${assetImage(a)}<span>${index + 1}</span><div><button type="button" data-move="${index},-1" aria-label="Przesuń materiał ${index + 1} w lewo" ${index === 0 ? "disabled" : ""}>←</button><button type="button" data-move="${index},1" aria-label="Przesuń materiał ${index + 1} w prawo" ${index === assets.length - 1 ? "disabled" : ""}>→</button><button type="button" data-remove="${a.id}" aria-label="Usuń materiał ${index + 1}">×</button></div></div>`,
      )
      .join("");
    content.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          post.assetIds = post.assetIds.filter((id) => id !== b.dataset.remove);
          drawAssets();
          void validate();
        }),
    );
    function move(from, to) {
      const [id] = post.assetIds.splice(from, 1);
      post.assetIds.splice(to, 0, id);
      drawAssets();
      void validate();
    }
    content.querySelectorAll("[data-move]").forEach(
      (b) =>
        (b.onclick = () => {
          const [i, delta] = b.dataset.move.split(",").map(Number);
          move(i, i + delta);
        }),
    );
    content.querySelectorAll("[data-order]").forEach((card) => {
      bindPointerDrag(card, "[data-order]", (destination) =>
        move(Number(card.dataset.order), Number(destination.dataset.order)),
      );
      card.ondragstart = (e) => {
        e.dataTransfer.setData(
          "application/x-genius-order",
          card.dataset.order,
        );
      };
      card.ondragover = (e) => e.preventDefault();
      card.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const value = e.dataTransfer.getData("application/x-genius-order");
        if (value !== "") move(Number(value), Number(card.dataset.order));
      };
    });
    content.querySelector("#compose-preview-media").innerHTML = assets[0]
      ? assetImage(assets[0], true) +
        (assets.length > 1
          ? `<span class="pub-carousel-count">1 / ${assets.length}</span>`
          : "")
      : '<div class="pub-preview-empty">Twój materiał<br>pojawi się tutaj.</div>';
  }
  async function validate() {
    collect();
    const call = ++validationId;
    validating = true;
    content.querySelector("#compose-preview-caption").textContent =
      post.caption || "Tutaj pojawi się opis publikacji.";
    content.querySelector(".pub-char-count").textContent =
      `${post.caption.length} znaków`;
    const later = new FormData(form).get("timing") === "later";
    content.querySelector("#compose-date-field").hidden = !later;
    content.querySelector("#compose-publish").textContent =
      `${later ? "Zaplanuj publikację" : post.options.tiktokMode === "inbox" && post.accountIds.length === 1 && data.accounts.find((a) => a.id === post.accountIds[0])?.platform === "tiktok" ? "Wyślij do TikToka" : "Opublikuj teraz"} ↗`;
    content.querySelector("#compose-publish").disabled = true;
    try {
      const {
        id,
        revision,
        createdAt,
        updatedAt,
        status,
        destinations,
        ...input
      } = post;
      const result = post.title.trim()
        ? await pubApi("validate", input)
        : { issues: ["Dodaj tytuł publikacji."] };
      if (!dialog.isConnected || call !== validationId) return;
      issues = result.issues;
      if (
        later &&
        (!post.scheduledAt || Date.parse(post.scheduledAt) <= Date.now())
      )
        issues.push("Wybierz przyszłą datę i godzinę.");
      content.querySelector("#compose-issues").innerHTML = issues.length
        ? `<strong>Przed publikacją</strong><ul>${issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul><small>Szkic możesz zapisać już teraz.</small>`
        : '<span class="pub-ready">✓ Treść gotowa do wysłania.</span>';
      content.querySelector("#compose-publish").disabled =
        issues.length > 0 || saving;
    } catch (error) {
      if (call === validationId) {
        issues = [error.message];
        content.querySelector("#compose-issues").textContent = error.message;
      }
    } finally {
      if (call === validationId) validating = false;
    }
  }
  const add = (assets) => {
    post.assetIds = [
      ...new Set([...post.assetIds, ...assets.map((a) => a.id)]),
    ];
    if (!post.title) {
      post.title = assets[0]?.name.replace(/\.[^.]+$/, "") || "";
      form.elements.title.value = post.title;
    }
    if (post.assetIds.length > 1) {
      post.format = "carousel";
      form.querySelector('[name="format"][value="carousel"]').checked = true;
    }
    drawAssets();
    void validate();
  };
  content.querySelector("#compose-upload").onclick = () => chooseUpload(add);
  bindTask(content.querySelector("#compose-studio"), () => studioLibrary(add));
  content.querySelector("#compose-library").onclick = () => {
    const picker = content.querySelector("#compose-library-picker");
    picker.hidden = !picker.hidden;
    picker.innerHTML = `<div class="pub-library-picker">${data.assets.map((a) => `<button type="button" data-select="${a.id}" ${post.assetIds.includes(a.id) ? "disabled" : ""}>${assetImage(a)}<span>${esc(a.name)}</span></button>`).join("") || "<p>Biblioteka jest pusta. Dodaj plik z dysku lub ze studia.</p>"}</div>`;
    picker.querySelectorAll("[data-select]").forEach(
      (b) =>
        (b.onclick = () => {
          add([data.assets.find((a) => a.id === b.dataset.select)]);
          b.disabled = true;
        }),
    );
  };
  const drop = content.querySelector(".pub-composer-drop");
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("drag-over");
  };
  drop.ondragleave = () => drop.classList.remove("drag-over");
  drop.ondrop = async (e) => {
    e.preventDefault();
    drop.classList.remove("drag-over");
    try {
      const id = e.dataTransfer.getData("application/x-genius-asset");
      add(
        id
          ? [data.assets.find((a) => a.id === id)].filter(Boolean)
          : await uploadFiles(e.dataTransfer.files),
      );
    } catch (error) {
      toast(error.message, true);
    }
  };
  content.querySelectorAll("[data-connect]").forEach(
    (b) =>
      (b.onclick = () => {
        collect();
        dialog.close();
        accountDialog(b.dataset.connect, null, () => openComposer(post));
      }),
  );
  form.addEventListener("input", (event) => {
    if (event.target.name === "accounts") {
      collect();
      optionsMarkup();
    }
    void validate();
  });
  async function save(action) {
    if (saving) return;
    collect();
    if (!post.title.trim()) {
      form.elements.title.reportValidity();
      return;
    }
    saving = true;
    try {
      if (action !== "draft") {
        await validate();
        if (issues.length || validating) return;
      }
      const { createdAt, updatedAt, status, destinations, ...input } = post;
      const saved = await pubApi("posts", input);
      post.id = saved.id;
      post.revision = saved.revision;
      if (action !== "draft")
        await pubApi(`posts/${saved.id}/action`, {
          action: post.scheduledAt ? "schedule" : "publish",
          revision: saved.revision,
          ...(post.scheduledAt ? { scheduledAt: post.scheduledAt } : {}),
        });
      try {
        sessionStorage.removeItem("genius:publication-draft");
      } catch {}
      dialog.close();
      currentView = action === "draft" ? "list" : "calendar";
      await refresh();
      toast(
        action === "draft"
          ? "Szkic zapisany."
          : post.scheduledAt
            ? "Publikacja zaplanowana."
            : "Wysyłka rozpoczęta. Wynik pojawi się w kolejce.",
      );
    } finally {
      saving = false;
    }
  }
  bindTask(content.querySelector("#compose-save"), () => save("draft"));
  form.onsubmit = (e) => {
    e.preventDefault();
    void task(content.querySelector("#compose-publish"), () =>
      save("publish"),
    ).catch(() => {});
  };
  if (post.id && ["draft", "scheduled"].includes(post.status)) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "pub-text-button";
    cancel.textContent = "Anuluj publikację";
    content.querySelector(".pub-composer-actions").append(cancel);
    bindTask(cancel, async () => {
      await pubApi(`posts/${post.id}/action`, {
        action: "cancel",
        revision: post.revision,
      });
      sessionStorage.removeItem("genius:publication-draft");
      dialog.close();
      await refresh();
      toast("Publikacja anulowana.");
    });
  }
  drawAssets();
  optionsMarkup();
  void validate();
}

function openPost(post) {
  if (["draft", "scheduled", "cancelled"].includes(post.status)) {
    openComposer(post);
    return;
  }
  const dialog = modal("Status publikacji"),
    content = dialog.querySelector(".pub-dialog-body");
  content.innerHTML = `<span class="pub-status ${post.status}">${statuses[post.status]}</span><h3>${esc(post.title)}</h3><p class="pub-caption-text">${esc(post.caption)}</p><div class="pub-destinations">${post.destinations
    .map((d) => {
      const a = data.accounts.find((a) => a.id === d.accountId);
      return `<section><header>${a ? icon(a.platform) : ""}<strong>${esc(a?.name || "Odłączone konto")}</strong><span class="pub-status ${d.status}">${statuses[d.status]}</span></header>${d.error ? `<p class="pub-error-text">${esc(d.error)}</p>` : ""}${d.status === "inbox" ? "<p>Otwórz powiadomienie w aplikacji TikTok i dokończ publikację.</p>" : ""}${d.remoteId ? `<small>ID platformy: ${esc(d.remoteId)}</small>` : ""}${/^https:\/\//.test(d.remoteUrl || "") ? `<a href="${esc(d.remoteUrl)}" target="_blank" rel="noopener">Zobacz publikację ↗</a>` : ""}</section>`;
    })
    .join(
      "",
    )}</div><div class="pub-composer-actions"><button class="btn" id="pub-status-refresh">Odśwież status</button>${post.destinations.some((d) => d.status === "failed") ? '<button class="btn" id="pub-retry">Ponów nieudane wysyłki</button>' : ""}<button class="btn" id="pub-duplicate">Utwórz podobny szkic</button></div>`;
  bindTask(content.querySelector("#pub-status-refresh"), async () => {
    await refresh();
    dialog.close();
    openPost(data.posts.find((p) => p.id === post.id));
  });
  bindTask(content.querySelector("#pub-retry"), async () => {
    await pubApi(`posts/${post.id}/action`, {
      action: "retry",
      revision: post.revision,
    });
    dialog.close();
    await refresh();
  });
  content.querySelector("#pub-duplicate").onclick = () => {
    dialog.close();
    const {
      id,
      revision,
      createdAt,
      updatedAt,
      destinations,
      status,
      ...draft
    } = post;
    openComposer({
      ...draft,
      scheduledAt: null,
      options: { ...draft.options, tiktokConsent: false },
    });
  };
}

export async function showPublisherAccounts() {
  document.dispatchEvent(
    new CustomEvent("genius:navigate-publisher", {
      detail: { view: "accounts" },
    }),
  );
}
function accountDialog(platform, id, returnToComposer) {
  const account = data.accounts.find((a) => a.id === id);
  const dialog = modal(
      `${names[platform]} · ${account ? "Ustawienia konta" : "Połącz konto"}`,
    ),
    content = dialog.querySelector(".pub-dialog-body");
  const help = {
    instagram: [
      "https://developers.facebook.com/apps/",
      "Utwórz aplikację Meta z Facebook Login. Dodaj pages_show_list, pages_read_engagement, instagram_basic i instagram_content_publish. Konto Instagram musi być profesjonalne i połączone ze stroną.",
    ],
    facebook: [
      "https://developers.facebook.com/apps/",
      "Utwórz aplikację Meta z Facebook Login. Dodaj pages_show_list, pages_read_engagement i pages_manage_posts. Publikujemy na stronach, nie na profilach osobistych.",
    ],
    threads: [
      "https://developers.facebook.com/apps/",
      "Dodaj Threads API: threads_basic i threads_content_publish. Meta wymaga HTTPS dla adresu powrotu Threads. W trybie lokalnym możesz wkleić token wygenerowany dla testera w panelu Meta.",
    ],
    tiktok: [
      "https://developers.tiktok.com/",
      "Dodaj Login Kit dla Desktop i Content Posting API. video.upload służy do wysyłki do aplikacji, video.publish do Direct Post. Publiczny Direct Post wymaga audytu; prywatne narzędzia do własnych kont nie kwalifikują się do tego trybu.",
    ],
    youtube: [
      "https://console.cloud.google.com/apis/credentials",
      "Włącz YouTube Data API v3. Utwórz klienta OAuth typu „Aplikacja internetowa”, skonfiguruj ekran zgody i dodaj siebie jako testera. Klucz API YouTube nie wystarcza do przesyłania filmów.",
    ],
  }[platform];
  content.innerHTML = `<p>${help[1]}</p><a class="pub-text-button" href="${help[0]}" target="_blank" rel="noopener">Otwórz panel deweloperski ↗</a><form class="pub-account-form"><label class="pub-field">Nazwa konta w studiu<input name="name" required value="${esc(account?.name || names[platform])}"></label><label class="pub-field">Client ID / App ID / Client Key<input name="clientId" autocomplete="off" placeholder="${account?.configuredFields.includes("clientId") ? "Zapisano — zostaw puste, aby zachować" : "Wklej identyfikator aplikacji"}"></label><label class="pub-field">Client Secret / App Secret<input type="password" name="clientSecret" autocomplete="new-password" placeholder="${account?.configuredFields.includes("clientSecret") ? "Zapisano — zostaw puste, aby zachować" : "Wklej sekret aplikacji"}"></label><label class="pub-field">Adres powrotu OAuth<code class="pub-copy-value">${esc(location.origin)}/api/publisher/oauth/callback</code></label><details class="pub-advanced"><summary>Token ręczny i ustawienia zaawansowane</summary><label class="pub-field">Access Token<input type="password" name="accessToken" autocomplete="new-password" placeholder="Token użytkownika; dla Facebooka token strony"></label><label class="pub-field">ID konta / strony<input name="remoteId" value="${esc(account?.remoteId || "")}" placeholder="Instagram / Threads / Facebook Page ID"></label><label class="pub-field">Refresh Token<input type="password" name="refreshToken" autocomplete="new-password"></label><label class="pub-field">Token wygasa (opcjonalnie)<input type="datetime-local" name="expiresAt"></label><label class="pub-field">Własny adres powrotu HTTPS<input name="redirectUri" type="url" placeholder="Opcjonalny; musi prowadzić do lokalnego callbacku"></label>${platform === "tiktok" ? '<label class="pub-check"><input name="direct" type="checkbox">Poproś też o video.publish (Direct Post)</label>' : ""}</details><p class="pub-key-note">Puste pola zachowują zapisane klucze. Sekrety są szyfrowane dla Twojego użytkownika Windows i nie wracają do przeglądarki.</p><div class="pub-composer-actions"><button class="btn" type="submit">Zapisz klucze</button><button class="btn accent" type="button" id="account-oauth">Zapisz i połącz konto ↗</button><button class="pub-text-button" type="button" id="account-verify">Sprawdź token</button>${account ? '<button class="pub-text-button" type="button" id="account-disconnect">Odłącz konto</button>' : ""}</div><p class="pub-inline-result" role="status"></p></form>`;
  let accountId = account?.id;
  async function save() {
    const values = new FormData(content.querySelector("form"));
    const credentials = Object.fromEntries(
      ["clientId", "clientSecret", "accessToken", "refreshToken", "redirectUri"]
        .map((key) => [key, String(values.get(key) || "").trim()])
        .filter(([, v]) => v),
    );
    const expiry = String(values.get("expiresAt") || "");
    const result = await pubApi("accounts", {
      id: accountId,
      platform,
      name: values.get("name"),
      remoteId: String(values.get("remoteId") || ""),
      credentials,
      ...(expiry ? { expiresAt: new Date(expiry).toISOString() } : {}),
    });
    accountId = result.id;
    content.querySelectorAll('input[type="password"]').forEach((input) => {
      input.value = "";
      input.placeholder = "Zapisano";
    });
    await refresh();
    return result;
  }
  content.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    void task(content.querySelector('[type="submit"]'), async () => {
      await save();
      content.querySelector(".pub-inline-result").textContent =
        "Klucze zapisane. Połącz konto lub sprawdź wklejony token.";
    }).catch(() => {});
  };
  bindTask(content.querySelector("#account-oauth"), async () => {
    await save();
    const result = await pubApi(`accounts/${accountId}/oauth`, {
      direct: Boolean(content.querySelector('[name="direct"]')?.checked),
    });
    location.assign(result.url);
  });
  bindTask(content.querySelector("#account-verify"), async () => {
    await save();
    await pubApi(`accounts/${accountId}/verify`, {});
    await refresh();
    content.querySelector(".pub-inline-result").textContent =
      "✓ Konto połączone. Możesz publikować.";
  });
  bindTask(content.querySelector("#account-disconnect"), async () => {
    await pubApi(`accounts/${accountId}/disconnect`, {});
    await refresh();
    dialog.close();
    toast("Konto odłączone. Klucze aplikacji zachowano.");
  });
  if (returnToComposer)
    dialog.addEventListener("close", returnToComposer, { once: true });
}
function hostingDialog() {
  const dialog = modal("Hosting mediów · Cloudflare R2"),
    content = dialog.querySelector(".pub-dialog-body");
  content.innerHTML = `<p>Użyj sesji OAuth z Wranglera. Aplikacja utworzy bucket na publiczne media i zapisze jego adres. Pliki będą wysyłane dopiero przy publikacji.</p>
  <div class="pub-r2-state"><span class="pub-eyebrow">WRANGLER / OAUTH</span><p id="wrangler-state" role="status">Sprawdzam lokalną sesję…</p></div>
  <form><label class="pub-field">Konto Cloudflare<select name="accountId" id="r2-account"><option value="">Wczytuję konta…</option></select></label><label class="pub-field">Bucket na publiczne media<input name="bucket" value="${esc(data.hosting.bucket || "genius-work-media")}" pattern="[a-z0-9-]{3,63}" required></label>
  ${data.hosting.publicBaseUrl ? `<label class="pub-field">Publiczny adres<code class="pub-copy-value">${esc(data.hosting.publicBaseUrl)}</code></label>` : ""}
  <button type="button" class="btn accent" id="r2-auto-setup" disabled>${data.hosting.configured ? "Sprawdź i zapisz połączenie" : "Skonfiguruj R2 przez Wrangler"} ↗</button>
  <details class="pub-advanced"><summary>Ręczna konfiguracja lub klucze S3 R2</summary><p>Opcjonalne klucze S3 pozwalają przesyłać pliki większe niż 300 MB. Sesja OAuth Wranglera obsługuje mniejsze pliki bez dodatkowych kluczy.</p><label class="pub-field">Autoryzacja<select name="r2Auth"><option value="wrangler">Wrangler OAuth</option><option value="s3">Klucze S3 R2</option></select></label>${[
    ["r2AccountId", "Cloudflare Account ID"],
    ["accessKeyId", "Access Key ID"],
    ["secretAccessKey", "Secret Access Key"],
    ["publicBaseUrl", "Publiczny adres bucketu HTTPS"],
  ]
    .map(
      ([name, label]) =>
        `<label class="pub-field">${label}<input name="${name}" type="${name === "secretAccessKey" ? "password" : name === "publicBaseUrl" ? "url" : "text"}" autocomplete="off"></label>`,
    )
    .join(
      "",
    )}<button type="submit" class="btn">Zapisz ręczną konfigurację</button></details>
  <details class="pub-advanced"><summary>Weryfikacja zdjęć dla TikToka</summary><p>W TikTok Dev dodaj publiczny adres bucketu jako URL prefix. Pobierz plik weryfikacyjny, wyślij go tutaj i kliknij Verify w panelu TikTok.</p><label class="pub-field">Zweryfikowany prefiks HTTPS<input type="url" name="verifiedMediaPrefix" value="${esc(data.hosting.verifiedMediaPrefix || "")}" placeholder="https://pub-…r2.dev/"></label><label class="pub-field">Plik weryfikacji TikTok<input type="file" id="hosting-verification" accept=".txt"></label><button type="button" class="btn" id="hosting-verify-file">Wyślij plik weryfikacji</button><button type="button" class="pub-text-button" id="hosting-save-prefix">Zapisz zweryfikowany prefiks</button><p id="hosting-verification-result" role="status"></p></details>
  <p class="pub-key-note">Tokeny OAuth pozostają pod kontrolą Wranglera. Ręczne klucze są szyfrowane lokalnie. Puste pola zachowują zapisane wartości.</p></form>`;
  const form = content.querySelector("form");
  form.elements.r2Auth.value = data.hosting.auth || "wrangler";
  pubApi("hosting/wrangler")
    .then((identity) => {
      if (!dialog.isConnected) return;
      content.querySelector("#wrangler-state").textContent = identity.loggedIn
        ? "✓ Sesja aktywna. Możesz użyć konta bez wklejania kluczy."
        : "Brak sesji. Uruchom npx wrangler login w terminalu.";
      content.querySelector("#r2-account").innerHTML =
        identity.accounts
          .map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`)
          .join("") || '<option value="">Brak kont</option>';
      content.querySelector("#r2-auto-setup").disabled =
        !identity.loggedIn || !identity.accounts.length;
    })
    .catch((error) => {
      if (dialog.isConnected)
        content.querySelector("#wrangler-state").textContent = error.message;
    });
  bindTask(content.querySelector("#r2-auto-setup"), async () => {
    const result = await pubApi("hosting/setup", {
      bucket: form.elements.bucket.value.trim(),
      accountId: form.elements.accountId.value,
    });
    await refresh();
    content.querySelector("#wrangler-state").textContent =
      `✓ R2 połączone: ${result.publicBaseUrl}`;
    toast("Hosting R2 gotowy.");
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    void task(content.querySelector('[type="submit"]'), async () => {
      const values = Object.fromEntries(
        [...new FormData(form)].filter(
          ([key, value]) =>
            key !== "accountId" && typeof value === "string" && value,
        ),
      );
      await pubApi("hosting", { ...values, provider: "r2" });
      await refresh();
      dialog.close();
      toast("Ustawienia R2 zapisane.");
    }).catch(() => {});
  };
  bindTask(content.querySelector("#hosting-verify-file"), async () => {
    const file = content.querySelector("#hosting-verification").files[0];
    if (!file) throw new Error("Wybierz plik TXT pobrany z TikTok Dev.");
    const result = await pubApi("hosting/verify-file", {
      name: file.name,
      content: await file.text(),
    });
    content.querySelector("#hosting-verification-result").textContent =
      `Plik dostępny: ${result.url}. Teraz kliknij Verify w TikTok Dev.`;
  });
  bindTask(content.querySelector("#hosting-save-prefix"), async () => {
    await pubApi("hosting", {
      verifiedMediaPrefix: form.elements.verifiedMediaPrefix.value,
    });
    await refresh();
    toast("Prefiks zapisany.");
  });
}
