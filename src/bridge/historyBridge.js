const { invoke } = window.__TAURI__.core;

export function createHistoryBridge() {
  return {
    async appendEntry(entry) {
      const payload = {
        query: entry?.query ?? "",
        response: entry?.response ?? "",
        timestamp: entry?.timestamp ?? "",
      };

      const result = await invoke("append_history_entry", { payload });
      return {
        ok: Boolean(result?.ok),
        message: result?.message ?? "",
      };
    },
  };
}
