package kz.yessenov.aristos.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R

/** Виджет «Кесте» (4×3, resize): расписание недели по дням. */
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
            val views = WidgetRenderer.root(context, R.layout.widget_week)
            views.removeAllViews(R.id.widget_days)
            if (snap == null) {
                views.setTextViewText(R.id.widget_title, "Aristos")
                WidgetRenderer.addTextRow(views, R.id.widget_days, context, "—", muted = true)
                return views
            }
            views.setTextViewText(R.id.widget_title, snap.labels["schedule"] ?: "Schedule")
            var any = false
            for (day in WidgetData.weekOrder()) {
                val lessons = WidgetData.lessonsForDay(snap, day)
                if (lessons.isEmpty()) continue
                any = true
                val dayViews = RemoteViews(context.packageName, R.layout.widget_row_day)
                dayViews.setTextViewText(R.id.widget_day_name, snap.days[day] ?: day)
                dayViews.removeAllViews(R.id.widget_day_pairs)
                for (lesson in lessons) {
                    val rv = RemoteViews(context.packageName, R.layout.widget_row_text)
                    rv.setTextViewText(R.id.widget_row_text, "${lesson.start} ${lesson.name}")
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
                    muted = true,
                )
            }
            return views
        }
    }
}
