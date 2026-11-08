package kz.yessenov.aristos

import android.appwidget.AppWidgetManager
import kz.yessenov.aristos.widgets.DeadlinesWidgetProvider
import kz.yessenov.aristos.widgets.NextPairsWidgetProvider
import kz.yessenov.aristos.widgets.WeekScheduleWidgetProvider
import kz.yessenov.aristos.widgets.WidgetData

class MainActivity : TauriActivity() {
    override fun onResume() {
        super.onResume()
        // Обновляем виджеты при каждом открытии приложения: снапшот мог
        // измениться (синк/импорт), а время на часах — тем более.
        try {
            val manager = AppWidgetManager.getInstance(this) ?: return
            val snap = WidgetData.load(this) // читаем файл один раз на всех
            NextPairsWidgetProvider.updateAll(this, manager, snap)
            WeekScheduleWidgetProvider.updateAll(this, manager, snap)
            DeadlinesWidgetProvider.updateAll(this, manager, snap)
        } catch (_: Exception) {
            // виджеты не критичны
        }
    }
}
