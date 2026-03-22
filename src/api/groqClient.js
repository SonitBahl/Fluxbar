const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

let cachedApiKey = null;

function getInvoke() {
  const core = window.__TAURI__?.core;
  if (!core?.invoke) {
    throw new Error("Tauri IPC not available (open this app with npm run tauri dev)");
  }
  return core.invoke.bind(core);
}

function parseGroqErrorPayload(bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const msg =
      data?.error?.message ??
      data?.message ??
      (typeof data?.error === "string" ? data.error : null);
    if (msg) {
      return String(msg);
    }
  } catch {
    // ignore
  }
  return bodyText?.slice(0, 500) ?? "Unknown error";
}

async function loadApiKeyFromEnv() {
  const invoke = getInvoke();
  const key = await invoke("get_groq_api_key");
  if (typeof key === "string" && key.trim()) {
    return key.trim();
  }
  return null;
}

async function loadApiKeyFromConfig() {
  const invoke = getInvoke();
  const raw = await invoke("read_launcher_config_json");
  if (raw == null || raw === "") {
    throw new Error("config file missing");
  }
  const parsed = JSON.parse(raw);
  const key =
    parsed.groqApiKey ?? parsed.GROQ_API_KEY ?? parsed.apiKey ?? parsed.key;
  if (!key || typeof key !== "string") {
    throw new Error(
      'config.json must include a string field "groqApiKey" (or GROQ_API_KEY)',
    );
  }
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error("groqApiKey is empty");
  }
  return trimmed;
}

async function resolveApiKey() {
  const fromEnv = await loadApiKeyFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  return loadApiKeyFromConfig();
}

/**
 * Parse one SSE line from Groq/OpenAI-style streaming.
 * @returns {string | null} delta text or null
 */
function parseSseDataLine(line) {
  const trimmed = line.replace(/\r$/, "").trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") {
    return null;
  }
  try {
    const json = JSON.parse(payload);
    const delta = json?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      return delta;
    }
  } catch {
    // ignore malformed chunk
  }
  return null;
}

/**
 * @param {string} prompt
 */
async function* streamCompletionImpl(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("Prompt is empty");
  }

  if (!cachedApiKey) {
    cachedApiKey = await resolveApiKey();
  }

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cachedApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: trimmed }],
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(
      `Groq API error (${res.status}): ${parseGroqErrorPayload(bodyText)}`,
    );
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const delta = parseSseDataLine(line);
      if (delta) {
        yield delta;
      }
    }
  }

  if (buffer.trim()) {
    const delta = parseSseDataLine(buffer);
    if (delta) {
      yield delta;
    }
  }
}

function wrapGroqError(err) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown error";
  if (
    msg.includes("forbidden") ||
    msg.includes("denied") ||
    msg.includes("not allowed")
  ) {
    return {
      ok: false,
      error: `Cannot read API key (${msg}).`,
    };
  }
  if (
    msg.includes("config file missing") ||
    msg.includes("No such file") ||
    msg.includes("ENOENT")
  ) {
    return {
      ok: false,
      error:
        'No API key: set GROQ_API_KEY in project .env (see .env.example) or add {"groqApiKey":"..."} to ~/.ai-launcher/config.json',
    };
  }
  return { ok: false, error: msg };
}

export function createGroqClient() {
  return {
    /**
     * Async generator: yields content deltas from Groq chat completions (SSE).
     * @param {string} prompt
     * @returns {AsyncGenerator<string, void, void>}
     */
    streamCompletion: streamCompletionImpl,

    /**
     * Non-streaming completion (collects full text from the same stream).
     * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string }>}
     */
    async complete(prompt) {
      try {
        let text = "";
        for await (const chunk of streamCompletionImpl(prompt)) {
          text += chunk;
        }
        return { ok: true, text };
      } catch (err) {
        return wrapGroqError(err);
      }
    },

    clearKeyCache() {
      cachedApiKey = null;
    },
  };
}
