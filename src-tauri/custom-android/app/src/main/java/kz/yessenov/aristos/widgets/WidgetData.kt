package kz.yessenov.aristos.widgets

import android.content.Context
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class Lesson(
    val day: String,
    val start: String,
    val end: String,
    val name: String,
    val room: String?,
)

data class Deadline(
    val title: String,
    val course: String,
    val dueAtIso: String,
    val dueAtMillis: Long,
)

data class NextLesson(val dayLabel: String, val lesson: Lesson)

data class Snapshot(
    val labels: Map<String, String>,
    val days: Map<String, String>,
    val daysFull: Map<String, String>,
    val lessons: List<Lesson>,
    val deadlines: List<Deadline>,
    val semesterStart: String?,
    val semesterEnd: String?,
    val holidays: List<Pair<String, String>>,
)

/** Читает widget_snapshot.json (его пишет Rust-команда write_widget_data
 *  при открытии приложения/синках) и вычисляет контент виджетов на момент
 *  рендера — поэтому виджет не «застывает» между обновлениями. */
object WidgetData {
    private const val FILE = "widget_snapshot.json"
    private val DAY_ORDER = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    // Calendar.DAY_OF_WEEK: SUNDAY=1..SATURDAY=7 → индекс в этом массиве
    private val DAY_KEYS = arrayOf("sun", "mon", "tue", "wed", "thu", "fri", "sat")

    fun load(context: Context): Snapshot? = try {
        val file = context.filesDir.resolve(FILE)
        if (!file.exists()) null else parse(file.readText())
    } catch (_: Exception) {
        null
    }

    private fun parse(text: String): Snapshot? = try {
        val root = JSONObject(text)
        if (root.optInt("v") != 1) null else {
            fun strMap(name: String): Map<String, String> {
                val out = LinkedHashMap<String, String>()
                val obj = root.optJSONObject(name)
                if (obj != null) for (k in obj.keys()) out[k] = obj.optString(k)
                return out
            }

            val lessons = mutableListOf<Lesson>()
            val lessonsArr = root.optJSONArray("lessons")
            if (lessonsArr != null) for (i in 0 until lessonsArr.length()) {
                val o = lessonsArr.getJSONObject(i)
                lessons += Lesson(
                    day = o.optString("day"),
                    start = o.optString("start"),
                    end = o.optString("end"),
                    name = o.optString("name"),
                    room = o.optString("room", "").ifEmpty { null },
                )
            }

            val deadlines = mutableListOf<Deadline>()
            val dlArr = root.optJSONArray("deadlines")
            if (dlArr != null) for (i in 0 until dlArr.length()) {
                val o = dlArr.getJSONObject(i)
                deadlines += Deadline(
                    title = o.optString("title"),
                    course = o.optString("course"),
                    dueAtIso = o.optString("dueAt"),
                    dueAtMillis = parseIso(o.optString("dueAt")),
                )
            }

            val sem = root.optJSONObject("semester")
            val holidays = mutableListOf<Pair<String, String>>()
            val hArr = root.optJSONArray("holidays")
            if (hArr != null) for (i in 0 until hArr.length()) {
                val o = hArr.getJSONObject(i)
                holidays += Pair(o.optString("start"), o.optString("end"))
            }

            Snapshot(
                labels = strMap("labels"),
                days = strMap("days"),
                daysFull = strMap("daysFull"),
                lessons = lessons,
                deadlines = deadlines,
                semesterStart = sem?.optString("start")?.ifEmpty { null },
                semesterEnd = sem?.optString("end")?.ifEmpty { null },
                holidays = holidays,
            )
        }
    } catch (_: Exception) {
        null
    }

    /** ISO "2026-11-15T20:00:00[.000][Z]" → millis (UTC). */
    private fun parseIso(iso: String): Long = try {
        val clean = iso.substringBefore('.').removeSuffix("Z")
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        fmt.parse(clean)?.time ?: 0L
    } catch (_: Exception) {
        0L
    }

    fun isoDate(cal: Calendar): String = String.format(
        Locale.US,
        "%04d-%02d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH),
    )

    fun dayKey(cal: Calendar): String = DAY_KEYS[cal.get(Calendar.DAY_OF_WEEK) - 1]

    private fun inSemester(snap: Snapshot, dayIso: String): Boolean {
        val start = snap.semesterStart ?: return true
        val end = snap.semesterEnd ?: return true
        return dayIso >= start && dayIso <= end
    }

    private fun isHoliday(snap: Snapshot, dayIso: String): Boolean =
        snap.holidays.any { dayIso >= it.first && dayIso <= it.second }

    fun lessonsForDay(snap: Snapshot, key: String): List<Lesson> =
        snap.lessons
            .filter { it.day.equals(key, ignoreCase = true) }
            .sortedBy { it.start }

    /** Ближайшие пары от текущего момента: сегодня (после now), затем
     *  следующие дни в семестре (праздники — тишина). */
    fun nextLessons(snap: Snapshot, now: Calendar, count: Int): List<NextLesson> {
        val out = mutableListOf<NextLesson>()
        val nowMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        for (offset in 0..7) {
            val cal = (now.clone() as Calendar).apply { add(Calendar.DATE, offset) }
            val dayIso = isoDate(cal)
            if (!inSemester(snap, dayIso) || isHoliday(snap, dayIso)) continue
            val label = when (offset) {
                0 -> snap.labels["today"] ?: "Today"
                1 -> snap.labels["tomorrow"] ?: "Tomorrow"
                else -> snap.daysFull[dayKey(cal)] ?: dayIso
            }
            for (lesson in lessonsForDay(snap, dayKey(cal))) {
                val m = parseMinutes(lesson.start) ?: continue
                if (offset == 0 && m <= nowMinutes) continue
                out += NextLesson(label, lesson)
                if (out.size >= count) return out
            }
        }
        return out
    }

    fun parseMinutes(time: String): Int? {
        val parts = time.split(":")
        if (parts.size < 2) return null
        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        return h * 60 + m
    }

    fun upcomingDeadlines(snap: Snapshot, nowMillis: Long, count: Int): List<Deadline> =
        snap.deadlines
            .filter { it.dueAtMillis >= nowMillis }
            .sortedBy { it.dueAtMillis }
            .take(count)

    fun formatDue(millis: Long): String =
        SimpleDateFormat("dd.MM HH:mm", Locale.US).format(Date(millis))

    fun weekOrder(): List<String> = DAY_ORDER
}
