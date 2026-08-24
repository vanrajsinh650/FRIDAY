package com.friday.modules

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.friday.services.FridaySchedulerReceiver

class SchedulerTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridaySchedulerNative"

    @ReactMethod
    fun scheduleExactAlarm(id: String, targetTimestamp: Double, title: String, payloadJson: String, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager == null) {
                promise.resolve(false)
                return
            }

            val triggerTime = targetTimestamp.toLong()
            val intent = Intent(reactContext, FridaySchedulerReceiver::class.java).apply {
                action = "com.friday.ACTION_EXACT_ALARM"
                putExtra("taskId", id)
                putExtra("title", title)
                putExtra("payloadJson", payloadJson)
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val requestCode = id.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(reactContext, requestCode, intent, flags)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    try {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                    } catch (se: SecurityException) {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                    }
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ALARM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelAlarm(id: String, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager == null) {
                promise.resolve(false)
                return
            }

            val intent = Intent(reactContext, FridaySchedulerReceiver::class.java).apply {
                action = "com.friday.ACTION_EXACT_ALARM"
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val requestCode = id.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(reactContext, requestCode, intent, flags)
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALARM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun schedulePeriodicWork(workName: String, intervalMinutes: Double, promise: Promise) {
        try {
            // Periodic background keepalive / work scheduling hook
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager != null) {
                val intervalMs = (intervalMinutes * 60 * 1000).toLong()
                val triggerTime = System.currentTimeMillis() + intervalMs
                val intent = Intent(reactContext, FridaySchedulerReceiver::class.java).apply {
                    action = "com.friday.ACTION_RESTART_SERVICE"
                    putExtra("workName", workName)
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val requestCode = workName.hashCode()
                val pendingIntent = PendingIntent.getBroadcast(reactContext, requestCode, intent, flags)
                alarmManager.setInexactRepeating(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    intervalMs,
                    pendingIntent
                )
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_WORK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelWork(workName: String, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager != null) {
                val intent = Intent(reactContext, FridaySchedulerReceiver::class.java).apply {
                    action = "com.friday.ACTION_RESTART_SERVICE"
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val requestCode = workName.hashCode()
                val pendingIntent = PendingIntent.getBroadcast(reactContext, requestCode, intent, flags)
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_WORK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                promise.resolve(alarmManager?.canScheduleExactAlarms() ?: false)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("OPEN_EXACT_ALARM_SETTINGS_ERROR", e.message)
        }
    }
}
