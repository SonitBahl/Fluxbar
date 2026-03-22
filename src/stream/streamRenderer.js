/**
 * Renders streamed model output as tokens arrive (SSE), without blocking the UI thread.
 * @param {object} ui — from createUiModule()
 */
export function createStreamRenderer(ui) {
  return {
    /**
     * Streams a prompt through the Groq client and updates the output panel incrementally.
     * @param {{ streamCompletion: (prompt: string) => AsyncGenerator<string> }} api
     * @param {string} prompt
     * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string }>}
     */
    async renderPrompt(api, prompt) {
      if (!ui) {
        throw new Error("streamRenderer requires ui dependency");
      }

      ui.beginStreamingOutput();

      let full = "";
      try {
        for await (const delta of api.streamCompletion(prompt)) {
          full += delta;
          ui.setStreamingText(full);
        }
        ui.finishStreamingOutput();
        return { ok: true, text: full };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Unknown error";
        ui.setOutputError(msg);
        return { ok: false, error: msg };
      }
    },
  };
}
