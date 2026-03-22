use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

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

static SESSION_LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

fn load_dotenv_from_project_root() {
    let env_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env");
    let _ = dotenvy::from_path(&env_path);
    let _ = dotenvy::dotenv();
}

fn launcher_dir_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "unable to resolve HOME directory".to_string())?;
    Ok(PathBuf::from(home).join(".ai-launcher"))
}

fn previous_chats_dir() -> Result<PathBuf, String> {
    Ok(launcher_dir_path()?.join("previous chats"))
}

fn ensure_launcher_dir_exists() -> Result<(), String> {
    let dir = launcher_dir_path()?;
    fs::create_dir_all(&dir).map_err(|err| format!("failed to create launcher directory: {err}"))
}

fn prime_session_log_path() -> Result<(), String> {
    let mut guard = SESSION_LOG_PATH
        .lock()
        .map_err(|_| "session log mutex poisoned".to_string())?;

    if guard.is_some() {
        return Ok(());
    }

    ensure_launcher_dir_exists()?;
    let dir = previous_chats_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|err| format!("failed to create previous chats directory: {err}"))?;

    let stamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    *guard = Some(dir.join(format!("{stamp}.txt")));
    Ok(())
}

fn session_log_file_path() -> Result<PathBuf, String> {
    prime_session_log_path()?;
    let guard = SESSION_LOG_PATH
        .lock()
        .map_err(|_| "session log mutex poisoned".to_string())?;
    guard
        .clone()
        .ok_or_else(|| "session log path not initialized".to_string())
}

fn append_history_record(payload: &HistoryAppendPayload) -> Result<(), String> {
    let file_path = session_log_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|err| format!("failed to open session history file: {err}"))?;

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
fn get_groq_api_key() -> Option<String> {
    std::env::var("GROQ_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
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
    load_dotenv_from_project_root();
    if let Err(err) = prime_session_log_path() {
        eprintln!("[fluxbar] could not prepare session log path: {err}");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![append_history_entry, get_groq_api_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
