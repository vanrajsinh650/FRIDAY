package com.friday.modules

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.friday.services.FridayFloatingOverlayService

class FloatingOverlayTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridayFloatingOverlayNative"

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactContext)
            } else {
                true
            }
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (!Settings.canDrawOverlays(reactContext)) {
                        try {
                            val intent = Intent(
                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:${reactContext.packageName}")
                            ).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            reactContext.startActivity(intent)
                            promise.resolve(true)
                        } catch (e: Exception) {
                            // Fallback for custom OEM ROMs (Xiaomi/MIUI, EMUI, ColorOS, OriginOS)
                            val fallbackIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            reactContext.startActivity(fallbackIntent)
                            promise.resolve(true)
                        }
                    } else {
                        promise.resolve(true)
                    }
                } else {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                promise.reject("REQUEST_OVERLAY_PERMISSION_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun showOverlay(statusText: String, state: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                    promise.resolve(false)
                    return@runOnUiThread
                }
                FridayFloatingOverlayService.show(reactContext, statusText, state)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("SHOW_OVERLAY_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun updateOverlay(statusText: String, state: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                FridayFloatingOverlayService.update(statusText, state)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("UPDATE_OVERLAY_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun hideOverlay(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                FridayFloatingOverlayService.hide(reactContext)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("HIDE_OVERLAY_ERROR", e.message)
            }
        }
    }
}
