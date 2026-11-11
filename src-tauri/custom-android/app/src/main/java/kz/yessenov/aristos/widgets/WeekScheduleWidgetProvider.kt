package kz.yessenov.aristos.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R
import java.util.Calendar

/** Виджет «Кесте» (4×3, resize): расписание недели по дням.
 *  Сегодняшний день подсвечивается (яркий акцент + суффикс « · Бүгін»). */
class WeekScheduleWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateAll(context, manager, WidgetData.load(context))
    }

    companion object {
        fun updateAll(context: Context, manager: AppWidgetManager, snap: Snapshot?) {
            val ids = manager.getAppWidgetIds(
                ComponentName(context, WeekScheduleWidgetProvider::class.java)
            )
            for (id in ids) manager.updateAppWidget(id, buildViews(context, snap))
        }

        fun buildViews(context: Context, snap: Snapshot?): RemoteViews {
            val pal = WidgetRenderer.palette(context)
            val views = WidgetRenderer.root(context, R.layout.widget_week, pal)
            views.removeAllViews(R.id.widget_days)
            WidgetRenderer.applyHeader(views, "Aristos", pal)
            if (snap == null) {
                WidgetRenderer.addTextRow(views, R.id.widget_days, context, "—", pal, muted = true)
                return views
            }
            WidgetRenderer.applyHeader(views, snap.labels["schedule"] ?: "Schedule", pal)
            val todayKey = WidgetData.dayKey(Calendar.getInstance())
            var any = false
            for (day in WidgetData.weekOrder()) {
                val lessons = WidgetData.lessonsForDay(snap, day)
                if (lessons.isEmpty()) continue
                any = true
                val isToday = day.equals(todayKey, ignoreCase = true)
                val dayViews = RemoteViews(context.packageName, R.layout.widget_row_day)
                val label = snap.days[day] ?: day
                val dayLabel = if (isToday) {
                    snap.labels["today"]?.let { "$label · $it" } ?: label
                } else {
                    label
                }
                dayViews.setTextViewText(R.id.widget_day_name, dayLabel)
                dayViews.setTextColor(R.id.widget_day_name, if (isToday) pal.header else pal.day)
                dayViews.removeAllViews(R.id.widget_day_pairs)
                for (lesson in lessons) {
                    val rv = RemoteViews(context.packageName, R.layout.widget_row_event)
                    rv.setTextViewText(R.id.widget_row_time, lesson.start)
                    rv.setTextViewText(R.id.widget_row_name, lesson.name)
                    rv.setTextColor(R.id.widget_row_time, pal.time)
                    rv.setTextColor(R.id.widget_row_name, pal.text)
                    dayViews.addView(R.id.widget_day_pairs, rv)
                }
                views.addView(R.id.widget_days, dayViews)
            }
            if (!any) {
                WidgetRenderer.addTextRow(
                    views,
                    R.id.widget_days,
                    context,
                    snap.labels["empty"] ?: "—",
                    pal,
                    muted = true,
                )
            }
            return views
        }
    }
}
