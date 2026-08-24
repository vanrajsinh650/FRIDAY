package com.friday.modules

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

class SystemControlTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridaySystemControlNative"

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        CoroutineScope(Dispatchers.Default).launch {
            try {
                val pm = reactContext.packageManager
                val query = packageName.trim()

                // Priority 1: Check direct exact package name
                var launchIntent = pm.getLaunchIntentForPackage(query)
                var targetPkg = query

                if (launchIntent == null) {
                    // Priority 2: Universal Dynamic Phonetic & Fuzzy Registry
                    val registry = com.friday.registry.AppDiscoveryRegistry.getInstance(reactContext)
                    val matchResult = registry.findBestMatch(query)
                    if (matchResult != null) {
                        targetPkg = matchResult.app.packageName
                        launchIntent = pm.getLaunchIntentForPackage(targetPkg)
                    }
                }

                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                    reactContext.startActivity(launchIntent)
                    withContext(Dispatchers.Main) {
                        promise.resolve(true)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        promise.resolve(false)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("LAUNCH_FAILED", e.message)
                }
            }
        }
    }

    @ReactMethod
    fun openUrl(url: String, promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_URL_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val pm = reactContext.packageManager
                val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                }
                val resolveInfos: List<ResolveInfo> = pm.queryIntentActivities(mainIntent, 0)
                val appsArray = Arguments.createArray()

                for (info in resolveInfos) {
                    val pkg = info.activityInfo.packageName
                    val label = info.loadLabel(pm).toString()
                    var iconBase64 = ""

                    try {
                        val iconDrawable = info.loadIcon(pm)
                        iconBase64 = drawableToBase64(iconDrawable)
                    } catch (_: Exception) {
                    }

                    val appMap = Arguments.createMap().apply {
                        putString("appName", label)
                        putString("packageName", pkg)
                        putString("icon", iconBase64)
                    }
                    appsArray.pushMap(appMap)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(appsArray)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("GET_APPS_FAILED", e.message)
                }
            }
        }
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
            drawable.bitmap
        } else {
            val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 72
            val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 72
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bmp
        }
        val scaled = Bitmap.createScaledBitmap(bitmap, 64, 64, true)
        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.PNG, 85, stream)
        val byteArray = stream.toByteArray()
        return "data:image/png;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    @ReactMethod
    fun isDefaultLauncher(promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
            }
            val resolveInfo = reactContext.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
            val currentHomePkg = resolveInfo?.activityInfo?.packageName
            val isDefault = currentHomePkg == reactContext.packageName
            promise.resolve(isDefault)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openDefaultLauncherSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_HOME_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val fallbackIntent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallbackIntent)
                promise.resolve(true)
            } catch (err: Exception) {
                promise.reject("SETTINGS_FAILED", err.message)
            }
        }
    }

    @ReactMethod
    fun openDefaultAssistantSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallback)
                promise.resolve(true)
            } catch (err: Exception) {
                promise.reject("SETTINGS_FAILED", err.message)
            }
        }
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getBatteryStatus(promise: Promise) {
        try {
            val bm = reactContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            val isCharging = bm.isCharging

            val map = Arguments.createMap().apply {
                putInt("level", level)
                putBoolean("isCharging", isCharging)
                putString("batteryHealth", "GOOD")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("BATTERY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getDeviceStats(promise: Promise) {
        try {
            // RAM
            val actManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)
            val totalRamMb = (memInfo.totalMem / (1024 * 1024)).toInt()
            val availRamMb = (memInfo.availMem / (1024 * 1024)).toInt()

            // Storage
            val stat = StatFs(Environment.getDataDirectory().path)
            val totalStorageGb = (stat.totalBytes / (1024 * 1024 * 1024)).toInt()
            val freeStorageGb = (stat.availableBytes / (1024 * 1024 * 1024)).toInt()

            // Battery
            val bm = reactContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val batteryLevel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            val isCharging = bm.isCharging

            val map = Arguments.createMap().apply {
                putInt("batteryLevel", batteryLevel)
                putBoolean("isCharging", isCharging)
                putInt("totalRamMb", totalRamMb)
                putInt("availRamMb", availRamMb)
                putInt("totalStorageGb", totalStorageGb)
                putInt("freeStorageGb", freeStorageGb)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("DEVICE_STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setVolume(streamType: String, percentage: Double, promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val stream = when (streamType.uppercase()) {
                "ALARM" -> AudioManager.STREAM_ALARM
                "RING" -> AudioManager.STREAM_RING
                else -> AudioManager.STREAM_MUSIC
            }
            val maxVolume = audioManager.getStreamMaxVolume(stream)
            val target = ((percentage / 100.0) * maxVolume).toInt()
            audioManager.setStreamVolume(stream, target, 0)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setBrightness(percentage: Double, promise: Promise) {
        try {
            val brightnessVal = ((percentage.coerceIn(0.0, 100.0) / 100.0) * 255).toInt()
            try {
                Settings.System.putInt(
                    reactContext.contentResolver,
                    Settings.System.SCREEN_BRIGHTNESS_MODE,
                    Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
                )
                Settings.System.putInt(
                    reactContext.contentResolver,
                    Settings.System.SCREEN_BRIGHTNESS,
                    brightnessVal
                )
            } catch (_: Exception) {}

            currentActivity?.let { act ->
                act.runOnUiThread {
                    val lp = act.window.attributes
                    lp.screenBrightness = (percentage.coerceIn(0.0, 100.0) / 100.0).toFloat()
                    act.window.attributes = lp
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BRIGHTNESS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setRingerMode(mode: String, promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            when (mode.uppercase()) {
                "SILENT" -> {
                    audioManager.ringerMode = AudioManager.RINGER_MODE_SILENT
                }
                "VIBRATE" -> {
                    audioManager.ringerMode = AudioManager.RINGER_MODE_VIBRATE
                }
                else -> {
                    audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
                    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING)
                    audioManager.setStreamVolume(AudioManager.STREAM_RING, (max * 0.8).toInt(), AudioManager.FLAG_SHOW_UI)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun dismissAlarm(promise: Promise) {
        try {
            val intent = Intent(android.provider.AlarmClock.ACTION_DISMISS_ALARM).apply {
                putExtra(android.provider.AlarmClock.EXTRA_ALARM_SEARCH_MODE, android.provider.AlarmClock.ALARM_SEARCH_MODE_NEXT)
                putExtra(android.provider.AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            showAlarms(promise)
        }
    }

    @ReactMethod
    fun setFlashlight(enabled: Boolean, promise: Promise) {
        val cameraManager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            var selectedId: String? = null
            for (id in cameraManager.cameraIdList) {
                val chars = cameraManager.getCameraCharacteristics(id)
                val hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (hasFlash && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    selectedId = id
                    break
                } else if (hasFlash && selectedId == null) {
                    selectedId = id
                }
            }
            val targetId = selectedId ?: cameraManager.cameraIdList.firstOrNull()
            if (targetId != null) {
                cameraManager.setTorchMode(targetId, enabled)
                promise.resolve(true)
            } else {
                promise.reject("FLASHLIGHT_ERROR", "No camera with flash unit found")
            }
        } catch (e: Exception) {
            promise.reject("FLASHLIGHT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getActiveNotifications(promise: Promise) {
        try {
            com.friday.services.FridayNotificationListener.ensureBound(reactContext)
            val listener = com.friday.services.FridayNotificationListener.instance
            if (listener != null) {
                val json = listener.getActiveNotificationsJson()
                promise.resolve(json)
            } else {
                promise.resolve("[]")
            }
        } catch (e: Exception) {
            promise.resolve("[]")
        }
    }

    @ReactMethod
    fun openNotificationListenerSettings(promise: Promise) {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setAlarm(hour: Int, minutes: Int, message: String?, skipUi: Boolean, promise: Promise) {
        try {
            val intent = Intent(android.provider.AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(android.provider.AlarmClock.EXTRA_HOUR, hour)
                putExtra(android.provider.AlarmClock.EXTRA_MINUTES, minutes)
                if (!message.isNullOrBlank()) {
                    putExtra(android.provider.AlarmClock.EXTRA_MESSAGE, message)
                }
                putExtra(android.provider.AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val fallbackIntent = Intent(android.provider.AlarmClock.ACTION_SET_ALARM).apply {
                    putExtra(android.provider.AlarmClock.EXTRA_HOUR, hour)
                    putExtra(android.provider.AlarmClock.EXTRA_MINUTES, minutes)
                    putExtra(android.provider.AlarmClock.EXTRA_SKIP_UI, false)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallbackIntent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("ALARM_ERROR", e2.message)
            }
        }
    }

    @ReactMethod
    fun sendWhatsAppMessage(phoneOrName: String?, message: String, promise: Promise) {
        try {
            val digits = phoneOrName?.filter { it.isDigit() } ?: ""
            val encodedMsg = java.net.URLEncoder.encode(message, "UTF-8")
            val url = if (digits.length >= 10) {
                "https://api.whatsapp.com/send?phone=$digits&text=$encodedMsg"
            } else {
                "https://api.whatsapp.com/send?text=$encodedMsg"
            }
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                setPackage("com.whatsapp")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WHATSAPP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getNextAlarmClock(promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val nextAlarm = alarmManager.nextAlarmClock
            if (nextAlarm != null) {
                val date = java.util.Date(nextAlarm.triggerTime)
                val sdf = java.text.SimpleDateFormat("h:mm a (EEEE)", java.util.Locale.getDefault())
                val formattedTime = sdf.format(date)
                val map = Arguments.createMap().apply {
                    putBoolean("hasAlarm", true)
                    putDouble("triggerTime", nextAlarm.triggerTime.toDouble())
                    putString("formattedTime", formattedTime)
                }
                promise.resolve(map)
            } else {
                val map = Arguments.createMap().apply {
                    putBoolean("hasAlarm", false)
                    putString("formattedTime", "None")
                }
                promise.resolve(map)
            }
        } catch (e: Exception) {
            val map = Arguments.createMap().apply {
                putBoolean("hasAlarm", false)
                putString("formattedTime", "Unknown")
            }
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun showAlarms(promise: Promise) {
        try {
            val intent = Intent(android.provider.AlarmClock.ACTION_SHOW_ALARMS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHOW_ALARMS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun makePhoneCall(phoneNumber: String, promise: Promise) {
        try {
            val digits = phoneNumber.filter { it.isDigit() || it == '+' }
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CALL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        try {
            val digits = phoneNumber.filter { it.isDigit() || it == '+' }
            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$digits")).apply {
                putExtra("sms_body", message)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openCamera(promise: Promise) {
        try {
            val intent = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CAMERA_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCurrentTime(promise: Promise) {
        try {
            val cal = java.util.Calendar.getInstance()
            val timeFormat = java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault())
            val dateFormat = java.text.SimpleDateFormat("EEEE, MMMM d, yyyy", java.util.Locale.getDefault())
            val timeStr = timeFormat.format(cal.time)
            val dateStr = dateFormat.format(cal.time)
            val map = Arguments.createMap().apply {
                putString("time", timeStr)
                putString("date", dateStr)
                putInt("hour", cal.get(java.util.Calendar.HOUR_OF_DAY))
                putInt("minutes", cal.get(java.util.Calendar.MINUTE))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            val map = Arguments.createMap().apply {
                putString("time", "12:00 AM")
                putString("date", "Today")
            }
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun saveMemoryFile(content: String, promise: Promise) {
        try {
            val file = java.io.File(reactContext.filesDir, "friday_memory.json")
            file.writeText(content, Charsets.UTF_8)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_MEMORY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun loadMemoryFile(promise: Promise) {
        try {
            val file = java.io.File(reactContext.filesDir, "friday_memory.json")
            if (file.exists()) {
                val content = file.readText(Charsets.UTF_8)
                promise.resolve(content)
            } else {
                promise.resolve("")
            }
        } catch (e: Exception) {
            promise.resolve("")
        }
    }

    @ReactMethod
    fun isMediaPlaying(promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            promise.resolve(audioManager.isMusicActive)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isCallActive(promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val inCall = audioManager.mode != AudioManager.MODE_NORMAL
            promise.resolve(inCall)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun pauseMediaPlayback(promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val downEvent = android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_MEDIA_PAUSE)
            val upEvent = android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_MEDIA_PAUSE)
            audioManager.dispatchMediaKeyEvent(downEvent)
            audioManager.dispatchMediaKeyEvent(upEvent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:" + reactContext.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
