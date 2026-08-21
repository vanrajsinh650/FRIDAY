package com.friday.modules

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SystemControlTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridaySystemControlNative"

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(launchIntent)
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("LAUNCH_FAILED", e.message)
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
    fun getBatteryStatus(promise: Promise) {
        val bm = reactContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val isCharging = bm.isCharging

        val map = Arguments.createMap().apply {
            putInt("level", level)
            putBoolean("isCharging", isCharging)
            putString("batteryHealth", "GOOD")
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun setVolume(streamType: String, percentage: Double, promise: Promise) {
        val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val stream = if (streamType == "ALARM") AudioManager.STREAM_ALARM else AudioManager.STREAM_MUSIC
        val maxVolume = audioManager.getStreamMaxVolume(stream)
        val target = ((percentage / 100.0) * maxVolume).toInt()
        audioManager.setStreamVolume(stream, target, 0)
        promise.resolve(true)
    }

    @ReactMethod
    fun setFlashlight(enabled: boolean, promise: Promise) {
        val cameraManager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            val cameraId = cameraManager.cameraIdList[0]
            cameraManager.setTorchMode(cameraId, enabled)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FLASHLIGHT_ERROR", e.message)
        }
    }
}
