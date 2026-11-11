package kz.yessenov.aristos

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class InstallApkArgs {
    lateinit var path: String
}

/** Прямая установка скачанного APK: content:// URI через собственный
 *  FileProvider (authority ${applicationId}.aristos.fileprovider, пути в
 *  res/xml/aristos_file_paths.xml) → системный установщик.
 *  Право «устанавливать неизвестные приложения» (REQUEST_INSTALL_PACKAGES)
 *  выдаётся один раз в настройках: если ещё не выдано — открываем
 *  системную страницу для этого приложения и отвечаем need-permission. */
@TauriPlugin
class UpdaterPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun installApk(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(InstallApkArgs::class.java)
            val file = File(args.path)
            if (!file.exists() || file.length() == 0L) {
                invoke.reject("APK не найден или пуст: ${args.path}")
                return
            }
            val ctx = activity.applicationContext
            // API 26+ (O): право выдаётся per-app в настройках
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !ctx.packageManager.canRequestPackageInstalls()
            ) {
                val settings = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${ctx.packageName}"),
                )
                settings.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                ctx.startActivity(settings)
                invoke.resolveObject(mapOf("status" to "need-permission"))
                return
            }
            val uri = FileProvider.getUriForFile(
                ctx,
                "${ctx.packageName}.aristos.fileprovider",
                file,
            )
            val install = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(install)
            invoke.resolveObject(mapOf("status" to "install-started"))
        } catch (e: ActivityNotFoundException) {
            invoke.reject("Не найден установщик пакетов", e)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "install failed", e)
        }
    }
}
