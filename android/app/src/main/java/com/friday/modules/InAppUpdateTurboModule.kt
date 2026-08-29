package com.friday.modules

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class InAppUpdateTurboModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridayInAppUpdateNative"

    @ReactMethod
    fun addListener(type: String?) {}

    @ReactMethod
    fun removeListeners(type: Double?) {}

    @ReactMethod
    fun getAppVersionInfo(promise: Promise) {
        try {
            val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.packageManager.getPackageInfo(
                    reactContext.packageName,
                    android.content.pm.PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
            }

            val vName = pInfo.versionName ?: "1.0.0"
            val vCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toDouble()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toDouble()
            }

            val map = Arguments.createMap().apply {
                putString("currentVersion", vName)
                putDouble("currentVersionCode", vCode)
                putString("packageName", reactContext.packageName)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_VERSION_FAILED", e.message)
        }
    }

    @ReactMethod
    fun canRequestPackageInstalls(promise: Promise) {
        try {
            val canInstall = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.packageManager.canRequestPackageInstalls()
            } else {
                true
            }
            promise.resolve(canInstall)
        } catch (e: Exception) {
            promise.reject("CAN_INSTALL_CHECK_FAILED", e.message)
        }
    }

    @ReactMethod
    fun openInstallPermissionSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_FAILED", e.message)
        }
    }

    @ReactMethod
    fun checkForUpdate(manifestUrl: String?, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val urlString = if (manifestUrl.isNullOrBlank()) {
                    "https://raw.githubusercontent.com/Friday-AI/releases/main/update.json"
                } else {
                    manifestUrl
                }

                val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    reactContext.packageManager.getPackageInfo(
                        reactContext.packageName,
                        android.content.pm.PackageManager.PackageInfoFlags.of(0)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
                }

                val currentVersionName = pInfo.versionName ?: "1.0.0"
                val currentVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    pInfo.longVersionCode.toDouble()
                } else {
                    @Suppress("DEPRECATION")
                    pInfo.versionCode.toDouble()
                }

                val connection = URL(urlString).openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.requestMethod = "GET"
                connection.setRequestProperty("Accept", "application/json")
                connection.connect()

                if (connection.responseCode in 200..299) {
                    val jsonText = connection.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(jsonText)

                    val latestVersion = json.optString("version", currentVersionName)
                    val latestVersionCode = json.optDouble("versionCode", currentVersionCode)
                    val apkUrl = json.optString("apkUrl", "")
                    val releaseNotes = json.optString("releaseNotes", "New stability and performance improvements.")
                    val forceUpdate = json.optBoolean("forceUpdate", false)

                    val isUpdateAvailable = latestVersionCode > currentVersionCode || isVersionHigher(latestVersion, currentVersionName)

                    val resultMap = Arguments.createMap().apply {
                        putBoolean("isUpdateAvailable", isUpdateAvailable)
                        putString("currentVersion", currentVersionName)
                        putDouble("currentVersionCode", currentVersionCode)
                        putString("latestVersion", latestVersion)
                        putDouble("latestVersionCode", latestVersionCode)
                        putString("releaseNotes", releaseNotes)
                        putString("apkUrl", apkUrl)
                        putBoolean("forceUpdate", forceUpdate)
                    }

                    withContext(Dispatchers.Main) {
                        promise.resolve(resultMap)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        val fallbackMap = Arguments.createMap().apply {
                            putBoolean("isUpdateAvailable", false)
                            putString("currentVersion", currentVersionName)
                            putDouble("currentVersionCode", currentVersionCode)
                            putString("latestVersion", currentVersionName)
                            putDouble("latestVersionCode", currentVersionCode)
                            putString("releaseNotes", "")
                            putString("apkUrl", "")
                            putBoolean("forceUpdate", false)
                        }
                        promise.resolve(fallbackMap)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CHECK_UPDATE_FAILED", e.message)
                }
            }
        }
    }

    @ReactMethod
    fun downloadAndInstallUpdate(apkUrl: String, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (apkUrl.isBlank()) {
                    withContext(Dispatchers.Main) {
                        promise.reject("INVALID_URL", "APK download URL cannot be empty")
                    }
                    return@launch
                }

                val updateFile = File(reactContext.cacheDir, "friday_update.apk")
                if (updateFile.exists()) {
                    updateFile.delete()
                }

                val url = URL(apkUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 15000
                connection.readTimeout = 30000
                connection.connect()

                if (connection.responseCode !in 200..299) {
                    withContext(Dispatchers.Main) {
                        promise.reject("DOWNLOAD_FAILED", "Server returned HTTP ")
                    }
                    return@launch
                }

                val fileLength = connection.contentLength.toLong()
                val input = BufferedInputStream(connection.inputStream)
                val output = FileOutputStream(updateFile)

                val buffer = ByteArray(8192)
                var total: Long = 0
                var count: Int
                var lastProgressEmit = 0L

                while (input.read(buffer).also { count = it } != -1) {
                    total += count
                    output.write(buffer, 0, count)

                    val now = System.currentTimeMillis()
                    if (fileLength > 0 && (now - lastProgressEmit > 100 || total == fileLength)) {
                        lastProgressEmit = now
                        val percent = ((total * 100) / fileLength).toInt()
                        sendProgressEvent(percent, total, fileLength)
                    }
                }

                output.flush()
                output.close()
                input.close()

                sendProgressEvent(100, total, total)

                // Launch Android Package Installer via FileProvider
                val apkUri: Uri = FileProvider.getUriForFile(
                    reactContext,
                    ".fileprovider",
                    updateFile
                )

                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

                withContext(Dispatchers.Main) {
                    reactContext.startActivity(installIntent)
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("INSTALL_FAILED", e.message)
                }
            }
        }
    }

    private fun sendProgressEvent(percent: Int, bytesDownloaded: Long, totalBytes: Long) {
        try {
            val params = Arguments.createMap().apply {
                putInt("percent", percent)
                putDouble("bytesDownloaded", bytesDownloaded.toDouble())
                putDouble("totalBytes", totalBytes.toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onUpdateDownloadProgress", params)
        } catch (_: Exception) {}
    }

    private fun isVersionHigher(remote: String, local: String): Boolean {
        try {
            val remoteParts = remote.split(".").map { it.toIntOrNull() ?: 0 }
            val localParts = local.split(".").map { it.toIntOrNull() ?: 0 }
            val maxLength = maxOf(remoteParts.size, localParts.size)

            for (i in 0 until maxLength) {
                val r = remoteParts.getOrElse(i) { 0 }
                val l = localParts.getOrElse(i) { 0 }
                if (r > l) return true
                if (r < l) return false
            }
        } catch (_: Exception) {}
        return false
    }
}
