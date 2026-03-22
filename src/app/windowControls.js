import { getCurrentWindow } from "@tauri-apps/api/window";

export async function closeCurrentWindow() {
  await getCurrentWindow().close();
}
