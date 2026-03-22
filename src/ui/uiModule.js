export function createUiModule() {
  let shellEl;
  let queryInputEl;
  let outputPanelEl;

  return {
    mount() {
      shellEl = document.querySelector("#app-shell");
      queryInputEl = document.querySelector("#query-input");
      outputPanelEl = document.querySelector("#output-panel");

      if (!shellEl || !queryInputEl || !outputPanelEl) {
        throw new Error("missing required UI elements");
      }

      outputPanelEl.classList.add("is-empty");
      queryInputEl.focus();
    },

    getQueryInput() {
      return queryInputEl;
    },

    getOutputPanel() {
      return outputPanelEl;
    },

    getQueryValue() {
      return queryInputEl?.value ?? "";
    },

    clearQuery() {
      if (queryInputEl) {
        queryInputEl.value = "";
      }
    },

    focusQuery() {
      queryInputEl?.focus();
    },

    setOutputText(text) {
      if (!outputPanelEl) {
        return;
      }
      outputPanelEl.classList.remove("is-empty", "output-panel--error");
      outputPanelEl.textContent = text;
    },

    setOutputError(message) {
      if (!outputPanelEl) {
        return;
      }
      outputPanelEl.classList.remove("is-empty");
      outputPanelEl.classList.add("output-panel--error");
      outputPanelEl.textContent = message;
    },

    setBusy(isBusy) {
      if (!queryInputEl) {
        return;
      }
      queryInputEl.disabled = Boolean(isBusy);
      if (!isBusy) {
        queryInputEl.focus();
      }
    },
  };
}
