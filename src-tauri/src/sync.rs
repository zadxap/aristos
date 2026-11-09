//! Нативный синк Canvas/Платонус (замена браузерного расширения).
//!
//! Механика: скрытое (или видимое — логин) webview-окно `harvest` грузит
//! внешний сайт; JS-оркестратор из фронтенда инжектит в него через
//! `sync_eval` самодостаточные скрипты (порты userscript/platonus-inpage),
//! которые выполняют same-origin fetch / DOM-harvest и возвращают результат
//! командой `sync_payload` → Rust рассылает событие `sync-payload` в main.
//!
//! Права IPC для внешних страниц: capabilities/remote-sync.json
//! (remote.urls на canvas/platonus/id.yu.edu.kz, permission allow-sync-payload).

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const HARVEST_LABEL: &str = "harvest";

fn parse_url(url: &str) -> Result<tauri::Url, String> {
    tauri::Url::parse(url).map_err(|e| format!("bad url {url:?}: {e}"))
}

/// Открыть (или переоткрыть с новым URL) harvest-окно.
/// visible=true — окно логина, false — скрытый harvest.
#[tauri::command]
pub fn sync_open(app: AppHandle, url: String, visible: bool) -> Result<(), String> {
    let target = parse_url(&url)?;
    if let Some(win) = app.get_webview_window(HARVEST_LABEL) {
        let same = win.url().map(|u| u == target).unwrap_or(false);
        if same {
            if visible {
                let _ = win.show();
                let _ = win.set_focus();
            }
            return Ok(());
        }
        // другой URL: закрываем и ждём фактического исчезновения лейбла,
        // чтобы не поймать гонку «label already exists» при пересоздании
        let _ = win.close();
        for _ in 0..40 {
            std::thread::sleep(std::time::Duration::from_millis(50));
            if app.get_webview_window(HARVEST_LABEL).is_none() {
                break;
            }
        }
    }
    let mut builder = WebviewWindowBuilder::new(
        &app,
        HARVEST_LABEL,
        WebviewUrl::External(target),
    )
    .title("Aristos Sync")
    .inner_size(940.0, 720.0);
    if !visible {
        builder = builder.visible(false);
    }
    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

/// Исполнить JS в harvest-окне (инжект-скрипты синка).
#[tauri::command]
pub fn sync_eval(app: AppHandle, js: String) -> Result<(), String> {
    let win = app
        .get_webview_window(HARVEST_LABEL)
        .ok_or_else(|| "harvest window is not open".to_string())?;
    win.eval(&js).map_err(|e| e.to_string())
}

/// Текущий URL harvest-окна (детект конца логина по смене страницы).
#[tauri::command]
pub fn sync_url(app: AppHandle) -> Result<String, String> {
    match app.get_webview_window(HARVEST_LABEL) {
        Some(win) => Ok(win.url().map(|u| u.to_string()).unwrap_or_default()),
        None => Ok(String::new()),
    }
}

#[tauri::command]
pub fn sync_close(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(HARVEST_LABEL) {
        let _ = win.close();
    }
    Ok(())
}

/// Вызывается ИЗ инжект-скриптов на внешних страницах (remote capability).
/// Любое сообщение драйвера (прогресс/payload/ошибка) уходит в main окно.
#[tauri::command]
pub fn sync_payload(app: AppHandle, json: String) -> Result<(), String> {
    app.emit("sync-payload", json).map_err(|e| e.to_string())
}
