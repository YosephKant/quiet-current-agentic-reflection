import { describe, it, expect } from "vitest";
import { formatApiErrorMessage, readApiJson } from "./readApiJson";

describe("readApiJson", () => {
  it("parses JSON bodies normally", async () => {
    const r = new Response(JSON.stringify({ error: "bad", hint: "try again" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
    const out = await readApiJson(r);
    expect(out.ok).toBe(false);
    expect(out.json.error).toBe("bad");
    expect(out.json.hint).toBe("try again");
  });

  it("surfaces non-JSON error pages as error text", async () => {
    const html = "<html><body>502 Bad Gateway</body></html>";
    const r = new Response(html, { status: 502, headers: { "content-type": "text/html" } });
    const out = await readApiJson(r);
    expect(out.ok).toBe(false);
    expect(String(out.json.error || "")).toContain("502");
  });
});

describe("formatApiErrorMessage", () => {
  it("joins error and hint", () => {
    expect(formatApiErrorMessage({ error: "a", hint: "b" }, "fallback")).toBe("a — b");
  });
});
