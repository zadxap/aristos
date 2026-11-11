//! Нативный Canvas-синк БЕЗ инжекта и IPC: сессия берётся из cookie-jar
//! webview (юзер логинится в окне приложения — куки персистентны), запросы
//! делает reqwest с Cookie + X-CSRF-Token заголовками. Порт логики
//! userscript-коллектора (endpoints, Link-пагинация ≤50 страниц, per_page=100,
//! нормализация itemType/extractCode, оценки из enrollments).

use percent_encoding::percent_decode_str;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

const CANVAS_ORIGIN: &str = "https://canvas.yu.edu.kz";
const MAX_PAGES: usize = 50;

fn webview_cookies(app: &AppHandle, url: &str) -> Result<Vec<(String, String)>, String> {
    // используется main-окно (jar у всех webview общий); async-команда —
    // обход документированного deadlock cookies() на Windows
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "no main window".to_string())?;
    let parsed = tauri::Url::parse(url).map_err(|e| e.to_string())?;
    let cookies = win.cookies_for_url(parsed).map_err(|e| e.to_string())?;
    Ok(cookies
        .iter()
        .map(|c| (c.name().to_string(), c.value().to_string()))
        .collect())
}

/// Есть ли живая сессия Canvas (по наличию _csrf_token в куках).
#[tauri::command]
pub async fn canvas_session_state(app: AppHandle) -> Result<Value, String> {
    let cookies = webview_cookies(&app, &format!("{CANVAS_ORIGIN}/"))?;
    let has_csrf = cookies.iter().any(|(n, _)| n == "_csrf_token");
    Ok(json!({ "hasSession": has_csrf, "cookieCount": cookies.len() }))
}

fn csrf_from(cookies: &[(String, String)]) -> Option<String> {
    cookies
        .iter()
        .find(|(n, _)| n == "_csrf_token")
        .map(|(_, v)| {
            percent_decode_str(v)
                .decode_utf8()
                .map(|s| s.to_string())
                .unwrap_or_else(|_| v.clone())
        })
}

struct CanvasClient {
    client: reqwest::Client,
    cookie_header: String,
    csrf: Option<String>,
}

impl CanvasClient {
    fn new(cookies: Vec<(String, String)>) -> Result<Self, String> {
        let csrf = csrf_from(&cookies);
        let cookie_header = cookies
            .iter()
            .map(|(n, v)| format!("{n}={v}"))
            .collect::<Vec<_>>()
            .join("; ");
        let client = reqwest::Client::builder()
            .user_agent("Aristos/0.1 (desktop)")
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self { client, cookie_header, csrf })
    }

    /// GET одной страницы API → (json, next-url из Link-заголовка).
    async fn api_page(&self, url: &str) -> Result<(Value, Option<String>), String> {
        let mut req = self
            .client
            .get(url)
            .header("Accept", "application/json")
            .header("Cookie", &self.cookie_header);
        if let Some(token) = &self.csrf {
            req = req.header("X-CSRF-Token", token);
        }
        let res = req.send().await.map_err(|e| format!("network: {e}"))?;
        let status = res.status().as_u16();
        if status == 401 {
            return Err("need-login".into());
        }
        if !res.status().is_success() {
            return Err(format!("Canvas API {status} для {url}"));
        }
        let next = res
            .headers()
            .get(reqwest::header::LINK)
            .and_then(|v| v.to_str().ok())
            .and_then(parse_next_link);
        let data: Value = res.json().await.map_err(|e| format!("json: {e}"))?;
        Ok((data, next))
    }

    /// Пагинация через Link-заголовок (≤50 страниц, per_page задаёт вызывающий).
    async fn api_all(&self, path: &str) -> Result<Vec<Value>, String> {
        let mut items = Vec::new();
        let mut url = format!("{CANVAS_ORIGIN}{path}");
        for _ in 0..MAX_PAGES {
            let (data, next) = self.api_page(&url).await?;
            match data.as_array() {
                Some(arr) => items.extend(arr.iter().cloned()),
                None => break,
            }
            match next {
                Some(n) => url = n,
                None => break,
            }
        }
        Ok(items)
    }
}

fn parse_next_link(link: &str) -> Option<String> {
    // <https://...>; rel="next"
    let idx = link.find("<")?;
    let end = link[idx + 1..].find('>')? + idx + 1;
    let url_part = &link[idx + 1..end];
    let rest = &link[end..];
    if rest.contains("rel=\"next\"") {
        Some(url_part.to_string())
    } else {
        None
    }
}

fn item_type(a: &Value) -> &'static str {
    let types: Vec<String> = a
        .get("submission_types")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    if a.get("is_quiz_assignment").and_then(|v| v.as_bool()).unwrap_or(false)
        || types.iter().any(|t| t == "online_quiz")
    {
        return "quiz";
    }
    if types.iter().any(|t| t == "discussion_topic") {
        return "discussion";
    }
    if types.iter().any(|t| t == "none") || types.is_empty() {
        return "other";
    }
    "assignment"
}

fn extract_code(name: &str, fallback: Option<&str>) -> String {
    if let Some(pos) = name.rfind('(') {
        let inner = &name[pos + 1..];
        if let Some(close) = inner.find(')') {
            let code = inner[..close].trim();
            if !code.is_empty() && !code.contains('(') {
                return code.to_string();
            }
        }
    }
    fallback
        .map(String::from)
        .unwrap_or_else(|| name.trim().to_string())
}

fn num_or_null(v: Option<&Value>) -> Value {
    match v {
        // терпимый парсинг: число или строка-число (защита от смены формы ответа)
        Some(Value::Number(n)) => json!(n.as_f64()),
        Some(Value::String(s)) => match s.trim().replace(',', ".").parse::<f64>() {
            Ok(n) => json!(n),
            Err(_) => Value::Null,
        },
        _ => Value::Null,
    }
}

fn grades_have_scores(enrollments: &[Value]) -> bool {
    enrollments.iter().any(|e| {
        e.get("grades")
            .and_then(|g| g.get("current_score"))
            .map(|s| !s.is_null())
            .unwrap_or(false)
    })
}

async fn sleep_ms(ms: u64) {
    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
}

/// Оценки курсов: до 3 попыток enrollments (ошибка ИЛИ «200 без оценок»),
/// затем per-course фолбэк — как в extension (см. CHANGELOG 11.11).
/// Возвращает (map course_id → (score, grade), diag-причина, scoresMissing).
async fn fetch_grade_map(
    client: &CanvasClient,
    course_ids: &[i64],
) -> (
    std::collections::HashMap<i64, (Value, Value)>,
    String,
    bool,
) {
    let mut grade_map: std::collections::HashMap<i64, (Value, Value)> =
        std::collections::HashMap::new();
    let mut diag = String::new();
    let mut enrollments: Option<Vec<Value>> = None;

    for attempt in 0..3 {
        match client
            .api_all("/api/v1/users/self/enrollments?include%5B%5D=total_scores&per_page=100")
            .await
        {
            Ok(list) => {
                if grades_have_scores(&list) {
                    enrollments = Some(list);
                    diag.clear();
                    break;
                }
                diag = format!("200 без оценок (попытка {})", attempt + 1);
            }
            Err(err) => {
                if err == "need-login" {
                    return (grade_map, err, true);
                }
                diag = err;
            }
        }
        if attempt < 2 {
            sleep_ms(if attempt == 0 { 1500 } else { 3000 }).await;
        }
    }

    if let Some(list) = enrollments {
        for e in &list {
            let Some(course_id) = e.get("course_id").and_then(|v| v.as_i64()) else {
                continue;
            };
            let g = e.get("grades").cloned().unwrap_or(Value::Null);
            let score = num_or_null(g.get("current_score"));
            let grade = g
                .get("current_grade")
                .and_then(|v| v.as_str())
                .map(|s| json!(s))
                .unwrap_or(Value::Null);
            grade_map.insert(course_id, (score, grade));
        }
        return (grade_map, diag, false);
    }

    // последний шанс: те же баллы per-course (по запросу на курс)
    for course_id in course_ids {
        match client
            .api_all(&format!(
                "/api/v1/courses/{course_id}/enrollments?include%5B%5D=total_scores&per_page=100"
            ))
            .await
        {
            Ok(list) => {
                if let Some(e) = list.iter().find(|e| grades_have_scores(std::slice::from_ref(e))) {
                    let g = e.get("grades").cloned().unwrap_or(Value::Null);
                    let score = num_or_null(g.get("current_score"));
                    let grade = g
                        .get("current_grade")
                        .and_then(|v| v.as_str())
                        .map(|s| json!(s))
                        .unwrap_or(Value::Null);
                    grade_map.insert(*course_id, (score, grade));
                    diag.clear();
                }
            }
            Err(_) => continue,
        }
    }
    if grade_map.is_empty() && diag.is_empty() {
        diag = "per-course фолбэк тоже без оценок".into();
    }
    let missing = grade_map.is_empty();
    (grade_map, diag, missing)
}

/// Полный Canvas-синк. Возвращает {"data": payload, "scoresMissing", "scoresDiag"};
/// Err("need-login") — нет/истекла сессия (JS открывает окно логина и повторяет).
#[tauri::command]
pub async fn canvas_sync_native(app: AppHandle) -> Result<Value, String> {
    let cookies = webview_cookies(&app, &format!("{CANVAS_ORIGIN}/"))?;
    let client = CanvasClient::new(cookies)?;

    let raw_courses = client
        .api_all("/api/v1/courses?enrollment_state=active&include%5B%5D=total_scores&include%5B%5D=enrollments&per_page=100")
        .await?;

    let course_ids: Vec<i64> = raw_courses
        .iter()
        .filter_map(|c| c.get("id").and_then(|v| v.as_i64()))
        .collect();

    // Оценки курса: enrollments с ретраями и per-course фолбэком
    // (total_scores на этом инстансе ненадёжен — оценки ушли в LTI-тул)
    let (mut grade_map, scores_diag, scores_missing) =
        fetch_grade_map(&client, &course_ids).await;
    if scores_missing && scores_diag == "need-login" {
        return Err("need-login".into());
    }

    let mut courses = Vec::new();
    for c in &raw_courses {
        let id = c.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let name = c
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let code_fallback = c.get("course_code").and_then(|v| v.as_str());
        let code = extract_code(&name, code_fallback);
        let (mut score, mut grade) = grade_map
            .get(&id)
            .cloned()
            .unwrap_or((Value::Null, Value::Null));
        if score.is_null() {
            if let Some(via) = c
                .get("enrollments")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|e| e.get("grades"))
            {
                score = num_or_null(via.get("current_score"));
                if grade.is_null() {
                    grade = via
                        .get("current_grade")
                        .and_then(|v| v.as_str())
                        .map(|s| json!(s))
                        .unwrap_or(Value::Null);
                }
            }
        }
        courses.push(json!({
            "id": id,
            "name": name,
            "code": code,
            "current_score": score,
            "current_grade": grade,
        }));
    }

    let mut assignments = Vec::new();
    for (i, c) in raw_courses.iter().enumerate() {
        let Some(course_id) = c.get("id").and_then(|v| v.as_i64()) else {
            continue;
        };
        let raw = match client
            .api_all(&format!(
                "/api/v1/courses/{course_id}/assignments?include%5B%5D=submission&order_by=due_at&per_page=100"
            ))
            .await
        {
            Ok(list) => list,
            Err(err) => {
                if err == "need-login" {
                    return Err(err);
                }
                // как в userscript: провал одного курса не роняет синк
                continue;
            }
        };
        let _ = i;
        for a in &raw {
            if a.get("published").and_then(|v| v.as_bool()) == Some(false) {
                continue;
            }
            let s = a.get("submission").cloned().unwrap_or(Value::Null);
            let graded = s.get("graded_at").is_some()
                || s.get("workflow_state").and_then(|v| v.as_str()) == Some("graded");
            let id = a.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            let title = a
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Без названия")
                .to_string();
            assignments.push(json!({
                "id": id,
                "course_id": course_id,
                "title": title,
                "type": item_type(a),
                "due_at": a.get("due_at").cloned().unwrap_or(Value::Null),
                "lock_at": a.get("lock_at").cloned().unwrap_or(Value::Null),
                "points_possible": a
                    .get("points_possible")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
                "html_url": a
                    .get("html_url")
                    .and_then(|v| v.as_str())
                    .map(String::from)
                    .unwrap_or_else(|| format!("{CANVAS_ORIGIN}/courses/{course_id}/assignments/{id}")),
                "submitted_at": s.get("submitted_at").cloned().unwrap_or(Value::Null),
                "score": s.get("score").cloned().unwrap_or(Value::Null),
                "graded": graded,
                "late": s.get("late").and_then(|v| v.as_bool()).unwrap_or(false),
                "missing": s.get("missing").and_then(|v| v.as_bool()).unwrap_or(false),
            }));
        }
    }

    let payload = json!({
        "format": "aristos-canvas-sync",
        "version": 1,
        "syncedAt": String::new(), // JS проставит new Date().toISOString()
        "source": "app",
        "courses": courses,
        "assignments": assignments,
    });
    Ok(json!({
        "data": payload,
        "scoresMissing": scores_missing,
        "scoresDiag": scores_diag,
    }))
}
