package com.friday.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FridaySchedulerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null) return
        // Handle both alarm-based restart and device boot
        when (intent?.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON",
            "com.friday.ACTION_RESTART_SERVICE" -> {
                FridayForegroundService.ensureStarted(context)
            }
            else -> {
                FridayForegroundService.ensureStarted(context)
            }
        }
    }
}
