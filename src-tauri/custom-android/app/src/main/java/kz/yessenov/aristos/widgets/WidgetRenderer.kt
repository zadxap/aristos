package kz.yessenov.aristos.widgets

import android.app.PendingIntent
import android.content.Context
import android.content.res.Configuration
import android.widget.RemoteViews
import kz.yessenov.aristos.R

/** Общее для всех виджетов: корневой RemoteViews с тапом на открытие
 *  приложения и добавление строк-строк. Палитра выбирается по теме системы
 *  на момент рендера: тёмная — прежний navy, светлая — для светлой темы
 *  лаунчера (цвета ставятся рантайм, XML-цвета остаются фоллбеком). */
object WidgetRenderer {
    /** Цвета и фон одного рендера. */
    data class Palette(
        val bgRes: Int,
        val header: Int,
        val time: Int,
        val text: Int,
        val day: Int,
        val muted: Int,
        val urgent: Int,
    )

    /** Тёмная/светлая палитра по ночному режиму конфигурации. */
    fun palette(context: Context): Palette {
        val night = (context.resources.configuration.uiMode and
            Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        return if (night) {
            Palette(
                bgRes = R.drawable.widget_bg,
                header = 0xFF7DD3FC.toInt(), // sky-300
                time = 0xFF7DD3FC.toInt(),
                text = 0xFFE2E8F0.toInt(),   // slate-200
                day = 0xFF93C5FD.toInt(),    // blue-300
                muted = 0xFF94A3B8.toInt(),  // slate-400
                urgent = 0xFFFB923C.toInt(), // orange-400
            )
        } else {
            Palette(
                bgRes = R.drawable.widget_bg_light,
                header = 0xFF0284C7.toInt(), // sky-600
                time = 0xFF0369A1.toInt(),   // sky-700
                text = 0xFF0F172A.toInt(),   // slate-900
                day = 0xFF1D4ED8.toInt(),    // blue-700
                muted = 0xFF64748B.toInt(),  // slate-500
                urgent = 0xFFEA580C.toInt(), // orange-600
            )
        }
    }

    /** Корневой RemoteViews: фон палитры + тап на открытие приложения. */
    fun root(context: Context, layoutId: Int, palette: Palette): RemoteViews {
        val views = RemoteViews(context.packageName, layoutId)
        views.setInt(R.id.widget_root, "setBackgroundResource", palette.bgRes)
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
    fun applyHeader(views: RemoteViews, title: String, palette: Palette) {
        views.setImageViewResource(R.id.widget_icon, R.mipmap.ic_launcher)
        views.setTextViewText(R.id.widget_title, title)
        views.setTextColor(R.id.widget_title, palette.header)
    }

    /** Одна строка-текст. muted — приглушённый цвет (пустые состояния). */
    fun addTextRow(
        views: RemoteViews,
        containerId: Int,
        context: Context,
        text: String,
        palette: Palette,
        muted: Boolean = false,
    ) {
        val rv = RemoteViews(context.packageName, R.layout.widget_row_text)
        rv.setTextViewText(R.id.widget_row_text, text)
        rv.setTextColor(R.id.widget_row_text, if (muted) palette.muted else palette.text)
        views.addView(containerId, rv)
    }

    /** Двухколонная строка: время/дата (акцент) + название.
     *  urgent — срочный дедлайн: время подсвечивается оранжевым. */
    fun addEventRow(
        views: RemoteViews,
        containerId: Int,
        context: Context,
        time: String,
        name: String,
        palette: Palette,
        urgent: Boolean = false,
    ) {
        val rv = RemoteViews(context.packageName, R.layout.widget_row_event)
        rv.setTextViewText(R.id.widget_row_time, time)
        rv.setTextViewText(R.id.widget_row_name, name)
        rv.setTextColor(R.id.widget_row_time, if (urgent) palette.urgent else palette.time)
        rv.setTextColor(R.id.widget_row_name, palette.text)
        views.addView(containerId, rv)
    }
}
