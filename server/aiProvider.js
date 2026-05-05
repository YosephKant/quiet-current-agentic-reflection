/**
 * Thin provider interface for AI completion calls.
 * Keeps the rest of the app independent from Ollama vs cloud providers.
 */
export function createAiProvider(config) {
  const mode = (config.chatMode || "ollama").toLowerCase();

  async function complete(messages, options = {}) {
    if (mode === "ollama") {
      const r = await fetch(`${config.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config.ollamaModel,
          messages,
          stream: false,
          ...options.ollamaExtras,
        }),
        signal: AbortSignal.timeout(options.timeoutMs || 120_000),
      });
      if (!r.ok) {
        const detail = await r.text();
        const err = new Error("ollama_upstream_failed");
        err.detail = detail;
        throw err;
      }
      const data = await r.json();
      return String(data?.message?.content ?? "");
    }

    if (mode === "openai") {
      if (!config.openaiBaseUrl || !config.openaiApiKey) {
        const err = new Error("openai_config_missing");
        throw err;
      }
      const u = new URL(
        "chat/completions",
        config.openaiBaseUrl.endsWith("/") ? config.openaiBaseUrl : config.openaiBaseUrl + "/"
      );
      const r = await fetch(u, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + config.openaiApiKey,
        },
        body: JSON.stringify({
          model: config.openaiModel,
          messages,
          temperature: options.temperature ?? 0.6,
        }),
      });
      if (!r.ok) {
        const detail = await r.text();
        const err = new Error("openai_upstream_failed");
        err.detail = detail;
        throw err;
      }
      const data = await r.json();
      return String(data?.choices?.[0]?.message?.content ?? "");
    }

    throw new Error("invalid_chat_mode");
  }

  return { mode, complete };
}

