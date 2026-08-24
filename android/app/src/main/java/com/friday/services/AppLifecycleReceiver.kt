package com.friday.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.friday.registry.AppDiscoveryRegistry

class AppLifecycleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val registry = AppDiscoveryRegistry.getInstance(context)
        val data = intent.data ?: return
        val packageName = data.schemeSpecificPart ?: return

        when (intent.action) {
            Intent.ACTION_PACKAGE_ADDED,
            Intent.ACTION_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_CHANGED -> {
                registry.onPackageAddedOrUpdated(packageName)
            }
            Intent.ACTION_PACKAGE_REMOVED -> {
                val replacing = intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)
                if (!replacing) {
                    registry.onPackageRemoved(packageName)
                }
            }
        }
    }
}
