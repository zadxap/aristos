package kz.yessenov.aristos.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R
import java.util.Calendar

/** Виджет «Келесі сабақтар» (4×2): ближайшие 3 пары от текущего момента. */
class NextPairsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        updateAll(context, manager, WidgetData.load(context))
    }

    companion object {
        fun updateAll(context: Context, manager: AppWidgetManager, snap: Snapshot?) {
            val ids = manager.getAppWidgetIds(
                ComponentName(context, NextPairsWidgetProvider::class.java)
            )
            for (id in ids) manager.updateAppWidget(id, buildViews(context, snap))
        }

        fun buildViews(context: Context, snap: Snapshot?): RemoteViews {
            val views = WidgetRenderer.root(context, R.layout.widget_list)
            views.removeAllViews(R.id.widget_rows)
            WidgetRenderer.applyHeader(views, "Aristos")
            if (snap == null) {
                WidgetRenderer.addTextRow(views, R.id.widget_rows, context, "—", muted = true)
                return views
            }
            val items = WidgetData.nextLessons(snap, Calendar.getInstance(), 3)
            if (items.isNotEmpty()) {
                WidgetRenderer.applyHeader(
                    views,
                    items.first().dayLabel,
                )
            }
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
                    WidgetRenderer.addEventRow(
                        views,
                        R.id.widget_rows,
                        context,
                        "${item.lesson.start}–${item.lesson.end}",
                        item.lesson.name + room,
                    )
                }
            }
            return views
        }
    }
}
