function getInvoke() {
  const core = window.__TAURI__?.core;
  if (!core?.invoke) {
    throw new Error("Tauri IPC not available");
  }
  return core.invoke.bind(core);
}

/**
 * Closes the current window via Rust (avoids bare imports from @tauri-apps/api in static ES modules).
 */
export async function closeCurrentWindow() {
  const invoke = getInvoke();
  await invoke("close_app");
}
