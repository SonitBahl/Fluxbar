import { createUiModule } from "../ui/uiModule.js";
import { createInputController } from "./inputController.js";
import { createGroqClient } from "../api/groqClient.js";
import { createStreamRenderer } from "../stream/streamRenderer.js";
import { createHistoryBridge } from "../bridge/historyBridge.js";

export function createAppController() {
  const ui = createUiModule();
  const api = createGroqClient();
  const stream = createStreamRenderer(ui);
  const history = createHistoryBridge();

  async function submitQuery(query) {
    ui.setBusy(true);
    try {
      const result = await api.complete(query);
      if (!result.ok) {
        ui.setOutputError(result.error);
        return;
      }
      ui.setOutputText(result.text);
    } finally {
      ui.setBusy(false);
    }
    void stream;
    void history;
  }

  const input = createInputController({ ui, submitQuery });

  return {
    mount() {
      ui.mount();
      input.bind();
    },
  };
}
