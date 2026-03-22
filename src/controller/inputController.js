import { closeCurrentWindow } from "../app/windowControls.js";

/**
 * @param {object} deps
 * @param {object} deps.ui 
 * @param {(query: string) => void | Promise<void>} deps.submitQuery 
 */
export function createInputController(deps) {
  if (!deps?.ui) {
    throw new Error("inputController requires ui dependency");
  }

  const submitQuery = deps.submitQuery;
  if (typeof submitQuery !== "function") {
    throw new Error("inputController requires submitQuery function");
  }

  return {
    bind() {
      const input = deps.ui.getQueryInput();
      if (!input) {
        throw new Error("query input not mounted");
      }

      input.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") {
          return;
        }
        e.preventDefault();

        const raw = deps.ui.getQueryValue();
        const query = raw.trim();
        if (!query) {
          return;
        }

        if (query === "/exit") {
          await closeCurrentWindow();
          return;
        }

        try {
          await submitQuery(query);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : String(err ?? "Unknown error");
          deps.ui.setOutputError(`Error: ${msg}`);
          console.error("[fluxbar] submitQuery failed:", err);
        }
      });

      window.addEventListener(
        "keydown",
        async (e) => {
          if (e.key !== "Escape") {
            return;
          }
          e.preventDefault();
          await closeCurrentWindow();
        },
        true,
      );
    },
  };
}
