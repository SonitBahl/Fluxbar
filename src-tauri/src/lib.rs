use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryAppendPayload {
    query: String,
    response: String,
    timestamp: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryAppendResult {
    ok: bool,
    message: String,
}

#[tauri::command]
fn append_history_entry(payload: HistoryAppendPayload) -> Result<HistoryAppendResult, String> {
    if payload.query.trim().is_empty() {
        return Err("query cannot be empty".to_string());
    }

    if payload.response.trim().is_empty() {
        return Err("response cannot be empty".to_string());
    }

    if payload.timestamp.trim().is_empty() {
        return Err("timestamp cannot be empty".to_string());
    }

    Ok(HistoryAppendResult {
        ok: true,
        message: "history append contract accepted".to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![append_history_entry])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
