package com.friday.services

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FridayNotificationListener : NotificationListenerService() {
    companion object {
        var instance: FridayNotificationListener? = null
            private set
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        // Track incoming alerts
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        instance = null
    }
}
