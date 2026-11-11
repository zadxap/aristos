import { useEffect } from "react"
import { useAristosDB } from "@/context/DBContext"
import { kk } from "@/i18n"
import { effectiveDeadline } from "@/lib/canvas"
import { loadNotifSettings, notifyOncePerDay } from "@/lib/notifications"
import { refreshNativeReminders } from "@/lib/reminders"
import { pushWidgetSnapshot } from "@/lib/widget-snapshot"
import { isTauriMobile } from "@/lib/tauri"

const MINUTE = 60_000

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Headless-агент уведомлений. На мобильном Tauri — перепланирует нативные
 *  напоминания (срабатывают и при закрытом приложении); на вебе/десктопе —
 *  раз в минуту проверяет пары и дедлайны, пока приложение открыто (v0). */
export function NotificationAgent() {
  const { schedule, calendar, activeSemester, canvasAssignments, canvasCourseMap } =
    useAristosDB()

  useEffect(() => {
    if (isTauriMobile()) {
      const refresh = () => {
        // Нативные напоминания (работают и при закрытом приложении)…
        void refreshNativeReminders({
          schedule,
          calendar,
          activeSemester,
          canvasAssignments,
        })
        // …и снапшот для Android-виджетов.
        void pushWidgetSnapshot({
          schedule,
          calendar,
          activeSemester,
          canvasAssignments,
          canvasCourseMap,
        })
      }
      refresh()
      const onVisible = () => {
        if (document.visibilityState === "visible") refresh()
      }
      const interval = window.setInterval(refresh, 6 * 60 * MINUTE)
      document.addEventListener("visibilitychange", onVisible)
      return () => {
        window.clearInterval(interval)
        document.removeEventListener("visibilitychange", onVisible)
      }
    }

    const tick = () => {
      const settings = loadNotifSettings()
      if (!settings.lessons && !settings.deadlines) return
      if (document.visibilityState !== "visible") return // v0: только на открытой вкладке

      const now = new Date()
      const todayKey = isoDay(now)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()

      // Пары сегодня (вне праздников и вне семестра — тишина): общая выборка
      // для напоминания перед парой и утреннего дайджеста.
      const sem = calendar?.semesters?.find(
        (s) => s.semester === activeSemester
      )
      const inSemester =
        !!sem && todayKey >= sem.semester_start && todayKey <= sem.semester_end
      const isHoliday = !!sem?.holidays?.some(
        (h) => todayKey >= h.start && todayKey <= h.end
      )
      const dayLessons =
        inSemester && !isHoliday && schedule
          ? (schedule.schedule || [])
              .filter(
                (e) =>
                  e.day.toLowerCase() ===
                  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
                    now.getDay()
                  ]
              )
              .sort((a, b) => a.start.localeCompare(b.start))
          : []

      // 1) Ближайшая пара: предмет в заголовке, время/аудитория в теле
      if (settings.lessons) {
        for (const lesson of dayLessons) {
          const [h, m] = lesson.start.split(":").map(Number)
          const diff = h * 60 + m - nowMinutes
          if (diff > 0 && diff <= settings.minutesBefore) {
            void notifyOncePerDay(
              `lesson-${todayKey}-${lesson.start}`,
              todayKey,
              lesson.subject_name,
              `${kk.notifLessonTitle} · ${lesson.start}${lesson.room ? ` · ${lesson.room}` : ""}`
            )
            break // одно уведомление на тик
          }
        }
      }

      // 1б) Дайджест дня: одно уведомление с 07:30 до конца дня
      if (
        settings.digest &&
        dayLessons.length > 0 &&
        nowMinutes >= 7 * 60 + 30
      ) {
        void notifyOncePerDay(
          `digest-${todayKey}`,
          todayKey,
          kk.notifDigestTitle(dayLessons.length),
          kk.notifDigestFirst(dayLessons[0].start)
        )
      }

      // 2) Дедлайны Canvas: не сданные, со сроком (или «Доступно до») в ближайшие 48 часов
      if (settings.deadlines) {
        const horizon = Date.now() + 48 * MINUTE
        for (const assignment of canvasAssignments ?? []) {
          const dueIso = effectiveDeadline(assignment)
          if (!dueIso || assignment.submitted_at) continue
          const due = Date.parse(dueIso)
          if (Number.isNaN(due) || due <= Date.now() || due > horizon) continue
          const dueStr = `${isoDay(new Date(due))} ${dueIso.slice(11, 16)}`
          void notifyOncePerDay(
            `deadline-${assignment.id}`,
            todayKey,
            assignment.title,
            `${kk.notifDeadlineTitle}: ${dueStr}`
          )
        }
      }
    }

    tick()
    const interval = window.setInterval(tick, MINUTE)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [schedule, calendar, activeSemester, canvasAssignments, canvasCourseMap])

  return null
}
