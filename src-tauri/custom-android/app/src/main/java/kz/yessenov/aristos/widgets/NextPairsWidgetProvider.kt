package kz.yessenov.aristos.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R
import java.util.Calendar

/** Виджет «Келесі сабақтар» (4×2): ближайшие 3 пары от текущего момента. */
class NextPairsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateAll(context, manager, ids)
    }

    companion object {
        fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val snap = WidgetData.load(context)
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
            val items = WidgetData.nextLessons(snap, Calendar.getInstance(), 3)
            views.setTextViewText(
                R.id.widget_title,
                items.firstOrNull()?.dayLabel ?: (snap.labels["today"] ?: "Aristos"),
            )
            if (items.isEmpty()) {
                WidgetRenderer.addTextRow(
                    views,
                    R.id.widget_rows,
                    context,
                    snap.labels["empty"] ?: "—",
                    muted = true,
                )
            } else {
                for (item in items) {
                    val room = item.lesson.room?.let { " · $it" } ?: ""
                    WidgetRenderer.addTextRow(
                        views,
                        R.id.widget_rows,
                        context,
                        "${item.lesson.start}–${item.lesson.end} ${item.lesson.name}$room",
                    )
                }
            }
            return views
        }
    }
}
