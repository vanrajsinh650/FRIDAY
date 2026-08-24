package com.friday.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.friday.modules.FridayPackage

class FridaySchedulerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null) return
        val action = intent?.action

        // Ensure background service is alive for proactive execution
        try {
            FridayForegroundService.ensureStarted(context)
        } catch (_: Exception) {}

        // If an exact alarm triggered, forward event to JS if React Native is loaded
        if (action == "com.friday.ACTION_EXACT_ALARM" || action == "com.friday.ACTION_SCHEDULED_TRIGGER") {
            val taskId = intent.getStringExtra("taskId") ?: ""
            val title = intent.getStringExtra("title") ?: ""
            val payloadJson = intent.getStringExtra("payloadJson") ?: "{}"

            val reactContext = FridayPackage.currentReactContext
            if (reactContext != null && reactContext.hasActiveReactInstance()) {
                val params = com.facebook.react.bridge.Arguments.createMap().apply {
                    putString("taskId", taskId)
                    putString("title", title)
                    putString("payloadJson", payloadJson)
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onScheduledAlarmTrigger", params)
            }
        }
    }
}
