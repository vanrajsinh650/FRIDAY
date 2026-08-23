package com.friday.services

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.friday.modules.FridayPackage
import org.json.JSONArray
import org.json.JSONObject

class FridayNotificationListener : NotificationListenerService() {
    companion object {
        var instance: FridayNotificationListener? = null
            private set

        fun ensureBound(context: Context) {
            if (instance == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    requestRebind(ComponentName(context, FridayNotificationListener::class.java))
                } catch (_: Exception) {}
            }
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        if (sbn.isOngoing || sbn.packageName == packageName) return

        try {
            val extras = sbn.notification.extras
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: ""
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim() ?: ""
            val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()?.trim() ?: ""

            if (title.isBlank() && text.isBlank()) return

            val pkg = sbn.packageName.lowercase()
            val appName = when {
                pkg.contains("whatsapp") -> "WhatsApp"
                pkg.contains("instagram") -> "Instagram"
                pkg.contains("youtube") -> "YouTube"
                pkg.contains("discord") -> "Discord"
                pkg.contains("telegram") -> "Telegram"
                pkg.contains("gmail") || pkg.contains("email") -> "Gmail"
                pkg.contains("mms") || pkg.contains("messaging") -> "Messages"
                else -> sbn.packageName.substringAfterLast('.').replaceFirstChar { it.uppercase() }
            }

            val spokenAlert = when (appName) {
                "WhatsApp" -> "Boss, in WhatsApp, $title sent a message: '$text'."
                "Instagram" -> "Boss, on Instagram, $title sent a message: '$text'."
                "YouTube" -> "Boss, on YouTube, $title uploaded: '$text'."
                else -> "Boss, you have a notification from $appName: $title. $text."
            }

            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            val isMediaOrCall = audioManager?.let {
                it.isMusicActive || it.mode != AudioManager.MODE_NORMAL
            } ?: false

            val reactContext = FridayPackage.currentReactContext
            if (reactContext != null) {
                val params = Arguments.createMap().apply {
                    putString("packageName", sbn.packageName)
                    putString("appName", appName)
                    putString("title", title)
                    putString("text", text)
                    putString("subText", subText)
                    putString("spokenAlert", spokenAlert)
                    putBoolean("isMediaOrCallActive", isMediaOrCall)
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onIncomingNotification", params)
            }
        } catch (_: Exception) {}
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        instance = null
    }

    fun getActiveNotificationsJson(): String {
        val array = JSONArray()
        try {
            val sbns = activeNotifications ?: return array.toString()
            for (sbn in sbns) {
                if (sbn.isOngoing && sbn.packageName == packageName) continue

                val extras = sbn.notification.extras
                val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
                val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
                val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""

                if (title.isBlank() && text.isBlank()) continue

                val obj = JSONObject().apply {
                    put("id", sbn.id)
                    put("packageName", sbn.packageName)
                    put("title", title)
                    put("text", text)
                    put("subText", subText)
                    put("postTime", sbn.postTime)
                }
                array.put(obj)
            }
        } catch (_: Exception) {}
        return array.toString()
    }
}
