package com.friday.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FridaySchedulerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            // Reschedule active alarms & restart background service
            val serviceIntent = Intent(context, FridayForegroundService::class.java)
            context?.startService(serviceIntent)
        }
    }
}
