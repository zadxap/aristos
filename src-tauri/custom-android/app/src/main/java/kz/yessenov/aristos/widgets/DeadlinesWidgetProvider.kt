package kz.yessenov.aristos.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R

/** Виджет «Мерзімдер» (4×2, resize): ближайшие дедлайны Canvas.
 *  Дедлайны ближе суток подсвечиваются оранжевым (urgent-палитра). */
class DeadlinesWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateAll(context, manager, WidgetData.load(context))
    }

    companion object {
        private const val DAY_MILLIS = 24 * 60 * 60 * 1000L

        fun updateAll(context: Context, manager: AppWidgetManager, snap: Snapshot?) {
            val ids = manager.getAppWidgetIds(
                ComponentName(context, DeadlinesWidgetProvider::class.java)
            )
            for (id in ids) manager.updateAppWidget(id, buildViews(context, snap))
        }

        fun buildViews(context: Context, snap: Snapshot?): RemoteViews {
            val pal = WidgetRenderer.palette(context)
            val views = WidgetRenderer.root(context, R.layout.widget_list, pal)
            views.removeAllViews(R.id.widget_rows)
            WidgetRenderer.applyHeader(views, "Aristos", pal)
            if (snap == null) {
                WidgetRenderer.addTextRow(views, R.id.widget_rows, context, "—", pal, muted = true)
                return views
            }
            WidgetRenderer.applyHeader(views, snap.labels["deadlines"] ?: "Deadlines", pal)
            val now = System.currentTimeMillis()
            val items = WidgetData.upcomingDeadlines(snap, now, 4)
            if (items.isEmpty()) {
                WidgetRenderer.addTextRow(
                    views,
                    R.id.widget_rows,
                    context,
                    snap.labels["noDeadlines"] ?: "—",
                    pal,
                    muted = true,
                )
            } else {
                for (dl in items) {
                    val course = if (dl.course.isNotEmpty()) " (${dl.course})" else ""
                    WidgetRenderer.addEventRow(
                        views,
                        R.id.widget_rows,
                        context,
                        WidgetData.formatDue(dl.dueAtMillis),
                        dl.title + course,
                        pal,
                        urgent = dl.dueAtMillis - now < DAY_MILLIS,
                    )
                }
            }
            return views
        }
    }
}
