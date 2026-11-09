//! Aristos — Tauri-обёртка над vite-билдом (см. ../CONTEXT.md).
//! Фронт тот же, что в PWA. Нативные напоминания планирует
//! tauri-plugin-notification из JS (src/lib/reminders.ts); снапшот для
//! Android-виджетов пишет write_widget_data; нативный синк Canvas/Платонус
//! живёт в sync.rs (скрытые webview + инжект-скрипты + IPC).

pub mod sync;

/// JS передаёт JSON-снапшот (src/lib/widget-snapshot.ts). На Android кладём
/// файл в app-каталог — его читают виджеты; на прочих платформах no-op.
#[tauri::command]
fn write_widget_data(app: tauri::AppHandle, data: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(dir.join("widget_snapshot.json"), data).map_err(|e| e.to_string())?;
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
        .invoke_handler(tauri::generate_handler![
            write_widget_data,
            sync::sync_open,
            sync::sync_eval,
            sync::sync_url,
            sync::sync_close,
            sync::sync_payload,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска tauri-приложения")
}
