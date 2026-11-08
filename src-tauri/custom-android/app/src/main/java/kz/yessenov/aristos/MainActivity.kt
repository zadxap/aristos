package kz.yessenov.aristos

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import kz.yessenov.aristos.widgets.DeadlinesWidgetProvider
import kz.yessenov.aristos.widgets.NextPairsWidgetProvider
import kz.yessenov.aristos.widgets.WeekScheduleWidgetProvider

class MainActivity : TauriActivity() {
    override fun onResume() {
        super.onResume()
        // Обновляем виджеты при каждом открытии приложения: снапшот мог
        // измениться (синк/импорт), а время на часах — тем более.
        try {
            val manager = AppWidgetManager.getInstance(this) ?: return
            for (provider in listOf(
                NextPairsWidgetProvider::class.java,
                WeekScheduleWidgetProvider::class.java,
                DeadlinesWidgetProvider::class.java,
            )) {
                val ids = manager.getAppWidgetIds(ComponentName(this, provider))
                if (ids.isNotEmpty()) provider.updateAll(this, manager, ids)
            }
        } catch (_: Exception) {
            // виджеты не критичны
        }
    }
}
