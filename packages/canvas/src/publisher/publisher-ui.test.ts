import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
import { postInput, validatePost } from "./model.js";

test("publisher UI: calendar drop, carousel reorder, draft restore, save and stale navigation", async () => {
  const dom = new JSDOM('<main id="workspace"></main>', {
      url: "http://127.0.0.1:4188",
    }),
    { window } = dom;
  const prior = new Map<string, PropertyDescriptor | undefined>();
  for (const key of [
    "window",
    "document",
    "location",
    "sessionStorage",
    "FormData",
    "CustomEvent",
  ]) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
    });
  }
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new window.Event("close"));
  };
  const accountId = randomUUID(),
    first = randomUUID(),
    second = randomUUID();
  const state = {
    version: 1,
    accounts: [
      {
        id: accountId,
        platform: "facebook",
        name: "Test Page",
        remoteId: "page",
        connected: true,
        configuredFields: [],
      },
    ],
    assets: [first, second].map((id, i) => ({
      id,
      type: "image",
      name: `Image ${i + 1}.jpg`,
      width: 1080,
      height: 1350,
      bytes: 1000,
      mime: "image/jpeg",
      file: `${id}.jpg`,
      createdAt: new Date().toISOString(),
    })),
    posts: [],
    hosting: { configured: false },
    timezone: "Europe/Warsaw",
  };
  const originalFetch = globalThis.fetch;
  const saved: any[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/state")) return Response.json(state);
    const body = JSON.parse(String(init?.body || "{}"));
    if (String(url).endsWith("/validate"))
      return Response.json({
        issues: validatePost(
          postInput.parse(body),
          state.assets,
          state.accounts,
          false,
        ),
      });
    if (String(url).endsWith("/posts")) {
      const result = {
        ...body,
        id: randomUUID(),
        revision: 1,
        status: "draft",
        destinations: [],
      };
      saved.push(result);
      state.posts.push(result);
      return Response.json(result);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const { mountPublisher, unmountPublisher } =
    await import("../../public/publisher.js");
  const target = window.document.querySelector("#workspace");
  const settle = () => new Promise((r) => setTimeout(r, 20));
  try {
    await mountPublisher(target, "calendar");
    const day = target.querySelector("[data-day]");
    const card = target.querySelector("[data-asset]");
    window.document.elementFromPoint = () => day;
    const startGesture = () =>
      card.onpointerdown({
        button: 0,
        target: card,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
      });
    const pointer = (type, x, y) =>
      window.document.dispatchEvent(
        new window.MouseEvent(type, {
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      );
    startGesture();
    pointer("pointermove", 12, 12);
    pointer("pointerup", 12, 12);
    assert.equal(
      window.document.querySelector("dialog"),
      null,
      "a click is not a drag",
    );
    startGesture();
    pointer("pointermove", 100, 100);
    assert.ok(window.document.querySelector(".pub-drag-label"));
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape" }),
    );
    pointer("pointerup", 100, 100);
    assert.equal(
      window.document.querySelector("dialog"),
      null,
      "Escape cancels a drag",
    );
    startGesture();
    pointer("pointermove", 100, 100);
    pointer("pointerup", 100, 100);
    await settle();
    assert.ok(
      window.document.querySelector("dialog [data-remove]"),
      "pointer drop creates a publication with the asset",
    );
    assert.equal(
      window.document.querySelector(".pub-drag-label"),
      null,
      "drag feedback is cleaned up",
    );
    window.document.querySelector("dialog").close();
    await day.ondrop({
      preventDefault() {},
      dataTransfer: {
        getData: (key: string) =>
          key === "application/x-genius-asset" ? first : "",
        files: [],
      },
    });
    await settle();
    let dialog = window.document.querySelector("dialog");
    assert.ok(dialog);
    assert.ok(dialog.querySelector(`[data-remove="${first}"]`));
    dialog.querySelector('[name="title"]').value = "Moja karuzela";
    dialog
      .querySelector('[name="title"]')
      .dispatchEvent(new window.Event("input", { bubbles: true }));
    dialog.querySelector("#compose-library").click();
    dialog.querySelector(`[data-select="${second}"]`).click();
    assert.equal(
      dialog.querySelector('[name="format"]:checked').value,
      "carousel",
    );
    // Pointer DnD and keyboard-accessible reorder buttons share the same ordered asset list.
    const last = dialog.querySelector('[data-order="1"]');
    last.ondrop({
      preventDefault() {},
      stopPropagation() {},
      dataTransfer: { getData: () => "0" },
    });
    assert.equal(
      dialog.querySelector('[data-order="0"] [data-remove]').dataset.remove,
      second,
    );
    dialog.querySelector('[data-move="0,1"]').click();
    assert.equal(
      dialog.querySelector('[data-order="0"] [data-remove]').dataset.remove,
      first,
    );
    await settle();
    dialog.close();
    target.querySelector("#pub-new").click();
    await settle();
    dialog = window.document.querySelector("dialog");
    assert.equal(dialog.querySelector('[name="title"]').value, "Moja karuzela");
    assert.equal(dialog.querySelectorAll("[data-order]").length, 2);
    assert.equal(dialog.querySelector("#compose-publish").disabled, true);
    dialog.querySelector("#compose-save").click();
    await settle();
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].assetIds, [first, second]);
    assert.deepEqual(saved[0].accountIds, []);
    assert.equal(
      window.sessionStorage.getItem("genius:publication-draft"),
      null,
    );
    assert.match(target.textContent, /Moja karuzela/);
    let resolveRequest;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      });
    const pending = mountPublisher(target);
    unmountPublisher();
    target.textContent = "Studio treści";
    resolveRequest(Response.json(state));
    await pending;
    assert.equal(target.textContent, "Studio treści");
  } finally {
    unmountPublisher();
    const toast = window.document.querySelector("#publisher-toast");
    if (toast?.hideTimer) clearTimeout(toast.hideTimer);
    globalThis.fetch = originalFetch;
    dom.window.close();
    for (const [key, descriptor] of prior)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  }
});
