use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

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

fn launcher_dir_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "unable to resolve HOME directory".to_string())?;
    Ok(PathBuf::from(home).join(".ai-launcher"))
}

fn history_file_path() -> Result<PathBuf, String> {
    Ok(launcher_dir_path()?.join("history.txt"))
}

fn ensure_launcher_dir_exists() -> Result<(), String> {
    let dir = launcher_dir_path()?;
    fs::create_dir_all(&dir).map_err(|err| format!("failed to create launcher directory: {err}"))
}

fn append_history_record(payload: &HistoryAppendPayload) -> Result<(), String> {
    ensure_launcher_dir_exists()?;
    let file_path = history_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|err| format!("failed to open history file: {err}"))?;

    let record = format!(
        "[{}]\nUser: {}\nAI: {}\n\n",
        payload.timestamp.trim(),
        payload.query.trim(),
        payload.response.trim()
    );

    file.write_all(record.as_bytes())
        .map_err(|err| format!("failed to append history entry: {err}"))?;
    file.sync_data()
        .map_err(|err| format!("failed to flush history entry: {err}"))?;
    Ok(())
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

    append_history_record(&payload)?;

    Ok(HistoryAppendResult {
        ok: true,
        message: "history entry appended".to_string(),
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
