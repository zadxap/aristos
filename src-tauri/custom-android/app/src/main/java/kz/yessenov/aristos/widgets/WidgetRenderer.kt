package kz.yessenov.aristos.widgets

import android.app.PendingIntent
import android.content.Context
import android.widget.RemoteViews
import kz.yessenov.aristos.R

/** Общее для всех виджетов: корневой RemoteViews с тапом на открытие
 *  приложения и добавление строк-строк. */
object WidgetRenderer {
    fun root(context: Context, layoutId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, layoutId)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
            val pi = PendingIntent.getActivity(
                context,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pi)
        }
        return views
    }

    /** Шапка: иконка приложения + акцентный заголовок. */
    fun applyHeader(views: RemoteViews, title: String) {
        views.setImageViewResource(R.id.widget_icon, R.mipmap.ic_launcher)
        views.setTextViewText(R.id.widget_title, title)
    }

    /** Одна строка-текст. muted — приглушённый цвет (пустые состояния). */
    fun addTextRow(
        views: RemoteViews,
        containerId: Int,
        context: Context,
        text: String,
        muted: Boolean = false,
    ) {
        val rv = RemoteViews(context.packageName, R.layout.widget_row_text)
        rv.setTextViewText(R.id.widget_row_text, text)
        if (muted) rv.setTextColor(R.id.widget_row_text, 0xFF94A3B8.toInt()) // slate-400
        views.addView(containerId, rv)
    }

    /** Двухколонная строка: время/дата (акцент) + название. */
    fun addEventRow(
        views: RemoteViews,
        containerId: Int,
        context: Context,
        time: String,
        name: String,
    ) {
        val rv = RemoteViews(context.packageName, R.layout.widget_row_event)
        rv.setTextViewText(R.id.widget_row_time, time)
        rv.setTextViewText(R.id.widget_row_name, name)
        views.addView(containerId, rv)
    }
}
