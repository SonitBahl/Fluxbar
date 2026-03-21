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
  const input = createInputController({ ui, api, stream, history });

  return {
    mount() {
      ui.mount();
      input.bind();
    },
  };
}
