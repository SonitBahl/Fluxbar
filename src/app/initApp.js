import { createAppController } from "../controller/appController.js";

export function initApp() {
  const controller = createAppController();
  controller.mount();
}
