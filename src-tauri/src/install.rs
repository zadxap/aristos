//! Прямая установка Android-обновлений: приложение само скачивает APK в кеш
//! и вызывает системный установщик через Kotlin-плагин (FileProvider →
//! content:// URI). На десктопе канал не нужен — там tauri-plugin-updater
//! ставит обновление сам.
//!
//! Схема: JS `installAndroidUpdate` → команда `download_update` (reqwest →
//! cache/apk/*.apk) → команда `install_apk` → run_mobile_plugin("installApk")
//! → UpdaterPlugin.kt → ACTION_VIEW с package-archive.

use tauri::{
    plugin::{Builder as PluginBuilder, PluginHandle, TauriPlugin},
    AppHandle, Runtime,
};

/// Дескриптор Kotlin-плагина UpdaterPlugin. Управляется только на Android
/// (register_android_plugin); на десктопе state не существует — команда
/// `install_apk` отвечает ошибкой, фронт падает обратно на браузер.
pub struct Installer<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    PluginBuilder::new("aristos-updater")
        .setup(|app, api| {
            // Регистрация НЕ фатальна: если Kotlin-плагин не поднялся,
            // приложение всё равно открывается — install_apk ответит ошибкой
            // и фронт откатится на скачивание через браузер.
            #[cfg(target_os = "android")]
            {
                use tauri::Manager as _;
                match api.register_android_plugin("kz.yessenov.aristos", "UpdaterPlugin") {
                    Ok(handle) => {
                        app.manage(Installer(handle));
                    }
                    Err(e) => {
                        // видно в logcat (тег RustStdoutStderr)
                        eprintln!("aristos-updater: регистрация не удалась: {e}");
                    }
                }
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = app;
                let _ = api;
            }
            Ok(())
        })
        .build()
}

/// Безопасное имя файла из URL: только буквы/цифры/.,-_
fn apk_file_name(url: &str) -> String {
    let raw = url.rsplit('/').next().unwrap_or("");
    let clean: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        .collect();
    if clean.len() > 128 {
        return "aristos-update.apk".into();
    }
    if clean.ends_with(".apk") && clean.len() > 4 {
        clean
    } else {
        "aristos-update.apk".into()
    }
}

/// Скачивает APK обновления в кеш приложения (app_cache_dir/apk),
/// подчищая прошлые версии. Возвращает путь к файлу.
#[tauri::command]
pub async fn download_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let resp = reqwest::get(&url).await.map_err(|e| format!("download: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("download: HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("read: {e}"))?;
    if bytes.is_empty() {
        return Err("download: пустой ответ".into());
    }

    use tauri::Manager;
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("cache dir: {e}"))?
        .join("apk");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let name = apk_file_name(&url);
    let path = dir.join(&name);
    // старые версии в кеше не нужны — остаётся только текущий файл
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path() != path {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("write: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Запускает системный установщик APK (только Android). Ответ
/// {"status":"need-permission"} — право «неизвестные источники» не выдано,
/// открыты системные настройки: пользователь должен разрешить и повторить.
#[tauri::command]
pub fn install_apk<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager as _;
        let installer = app
            .try_state::<Installer<R>>()
            .ok_or_else(|| "install_apk доступен только на Android".to_string())?;
        // run_mobile_plugin существует только на мобильных таргетах
        installer
            .0
            .run_mobile_plugin::<serde_json::Value>(
                "installApk",
                serde_json::json!({ "path": path }),
            )
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let _ = path;
        Err("install_apk доступен только на Android".to_string())
    }
}
