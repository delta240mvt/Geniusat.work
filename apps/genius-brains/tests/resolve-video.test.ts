import { describe, expect, it } from "vitest";

import { resolveChannel } from "../src/youtube/resolve-channel.js";
import { resolveVideo } from "../src/youtube/resolve-video.js";

describe("resolveVideo", () => {
  it("builds a bootstrap request from a channel handle", () => {
    expect(resolveVideo("@fireship")).toEqual({
      kind: "channel-bootstrap",
      input: "@fireship",
      channel: {
        kind: "channel",
        bootstrapBy: "handle",
        handle: "fireship",
        canonicalUrl: "https://www.youtube.com/@fireship",
      },
      request: {
        kind: "list-channel-videos",
        channel: {
          kind: "channel",
          bootstrapBy: "handle",
          handle: "fireship",
          canonicalUrl: "https://www.youtube.com/@fireship",
        },
        filters: {
          limit: 25,
          includeShorts: true,
          includeLive: false,
        },
      },
    });
  });

  it("builds a bootstrap request from a /channel/<id> URL and applies filters", () => {
    expect(
      resolveVideo("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", {
        limit: 5,
        includeLive: true,
      }),
    ).toEqual({
      kind: "channel-bootstrap",
      input: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
      channel: {
        kind: "channel",
        bootstrapBy: "channel-id",
        channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
        canonicalUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
      },
      request: {
        kind: "list-channel-videos",
        channel: {
          kind: "channel",
          bootstrapBy: "channel-id",
          channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
          canonicalUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
        },
        filters: {
          limit: 5,
          includeShorts: true,
          includeLive: true,
        },
      },
    });
  });

  it("rejects unsupported bootstrap channel forms", () => {
    expect(() => resolveVideo("https://www.youtube.com/c/fireship")).toThrow(
      "Only @handle and /channel/<id> YouTube inputs are supported for bootstrap resolution.",
    );
  });

  it("parses a full @handle channel URL", () => {
    expect(resolveChannel("https://www.youtube.com/@openai")).toEqual({
      kind: "channel",
      bootstrapBy: "handle",
      handle: "openai",
      canonicalUrl: "https://www.youtube.com/@openai",
    });
  });
});
