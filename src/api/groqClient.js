import { readTextFile } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

const CONFIG_REL_PATH = ".ai-launcher/config.json";

let cachedApiKey = null;

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

  }
  return bodyText?.slice(0, 500) ?? "Unknown error";
}

async function loadApiKeyFromEnv() {
  const key = await invoke("get_groq_api_key");
  if (typeof key === "string" && key.trim()) {
    return key.trim();
  }
  return null;
}

async function loadApiKeyFromConfig() {
  const raw = await readTextFile(CONFIG_REL_PATH, { baseDir: BaseDirectory.Home });
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

export function createGroqClient() {
  return {
    /**
     * Returns a non-streaming chat completion for the user prompt.
     * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string }>}
     */
    async complete(prompt) {
      const trimmed = prompt.trim();
      if (!trimmed) {
        return { ok: false, error: "Prompt is empty" };
      }

      try {
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
          }),
        });

        const bodyText = await res.text();

        if (!res.ok) {
          return {
            ok: false,
            error: `Groq API error (${res.status}): ${parseGroqErrorPayload(bodyText)}`,
          };
        }

        let data;
        try {
          data = JSON.parse(bodyText);
        } catch {
          return { ok: false, error: "Invalid JSON response from Groq" };
        }

        const text =
          data?.choices?.[0]?.message?.content ??
          data?.choices?.[0]?.delta?.content ??
          "";

        if (typeof text !== "string") {
          return { ok: false, error: "Unexpected response shape from Groq" };
        }

        return { ok: true, text };
      } catch (err) {
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
            error: `Cannot read API key (${msg}). Check fs permissions for ~/.ai-launcher/config.json`,
          };
        }
        if (msg.includes("No such file") || msg.includes("ENOENT")) {
          return {
            ok: false,
            error:
              'No API key: set GROQ_API_KEY in project .env (see .env.example) or add {"groqApiKey":"..."} to ~/.ai-launcher/config.json',
          };
        }
        return { ok: false, error: msg };
      }
    },

    clearKeyCache() {
      cachedApiKey = null;
    },
  };
}
