//! Aristos — Tauri-обёртка над vite-билдом (см. ../CONTEXT.md).
//! Фронт тот же, что в PWA. Нативные напоминания планирует
//! tauri-plugin-notification из JS (src/lib/reminders.ts); снапшот для
//! Android-виджетов пишет write_widget_data; нативный синк Canvas/Платонус
//! живёт в sync.rs (скрытые webview + инжект-скрипты + IPC).

pub mod canvas;
pub mod install;
pub mod sync;

/// JS передаёт JSON-снапшот (src/lib/widget-snapshot.ts). На Android кладём
/// файл в app-каталог — его читают виджеты; на прочих платформах no-op.
/// Маппинг app_data_dir на Android неочевиден (dataDir или filesDir, с
/// identifier-поддиректорией или без) — пишем в dir и dir/files, а Kotlin
/// читает все четыре кандидата (WidgetData.load).
#[tauri::command]
fn write_widget_data(app: tauri::AppHandle, data: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(dir.join("widget_snapshot.json"), data.clone())
            .map_err(|e| e.to_string())?;
        let files = dir.join("files");
        let _ = std::fs::create_dir_all(&files);
        let _ = std::fs::write(files.join("widget_snapshot.json"), data);
        return Ok(());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let _ = data;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(install::init())
        .invoke_handler(tauri::generate_handler![
            write_widget_data,
            install::download_update,
            install::install_apk,
            sync::sync_open,
            sync::sync_eval,
            sync::sync_url,
            sync::sync_diag,
            sync::sync_close,
            sync::sync_payload,
            canvas::canvas_session_state,
            canvas::canvas_sync_native,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска tauri-приложения")
}
