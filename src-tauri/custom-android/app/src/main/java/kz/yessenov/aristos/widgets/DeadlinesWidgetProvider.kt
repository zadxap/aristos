package kz.yessenov.aristos.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R

/** Виджет «Мерзімдер» (4×2, resize): ближайшие дедлайны Canvas. */
class DeadlinesWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateAll(context, manager, WidgetData.load(context))
    }

    companion object {
        fun updateAll(context: Context, manager: AppWidgetManager, snap: Snapshot?) {
            val ids = manager.getAppWidgetIds(
                ComponentName(context, DeadlinesWidgetProvider::class.java)
            )
            for (id in ids) manager.updateAppWidget(id, buildViews(context, snap))
        }

        fun buildViews(context: Context, snap: Snapshot?): RemoteViews {
            val views = WidgetRenderer.root(context, R.layout.widget_list)
            views.removeAllViews(R.id.widget_rows)
            if (snap == null) {
                views.setTextViewText(R.id.widget_title, "Aristos")
                WidgetRenderer.addTextRow(views, R.id.widget_rows, context, "—", muted = true)
                return views
            }
            views.setTextViewText(R.id.widget_title, snap.labels["deadlines"] ?: "Deadlines")
            val items = WidgetData.upcomingDeadlines(snap, System.currentTimeMillis(), 5)
            if (items.isEmpty()) {
                WidgetRenderer.addTextRow(
                    views,
                    R.id.widget_rows,
                    context,
                    snap.labels["noDeadlines"] ?: "—",
                    muted = true,
                )
            } else {
                for (dl in items) {
                    val course = if (dl.course.isNotEmpty()) " (${dl.course})" else ""
                    WidgetRenderer.addTextRow(
                        views,
                        R.id.widget_rows,
                        context,
                        "${WidgetData.formatDue(dl.dueAtMillis)} · ${dl.title}$course",
                    )
                }
            }
            return views
        }
    }
}
