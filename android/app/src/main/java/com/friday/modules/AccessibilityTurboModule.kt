package com.friday.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.friday.accessibility.FridayAccessibilityService
import com.friday.accessibility.GestureDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AccessibilityTurboModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridayAccessibilityNative"

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        val isEnabled = FridayAccessibilityService.instance != null
        promise.resolve(isEnabled)
    }

    @ReactMethod
    fun clickCoordinates(x: Double, y: Double, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not enabled")
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            val success = GestureDispatcher.click(service, x.toFloat(), y.toFloat())
            promise.resolve(success)
        }
    }

    @ReactMethod
    fun swipe(startX: Double, startY: Double, endX: Double, endY: Double, durationMs: Double, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not enabled")
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            val success = GestureDispatcher.swipe(
                service,
                startX.toFloat(),
                startY.toFloat(),
                endX.toFloat(),
                endY.toFloat(),
                durationMs.toLong()
            )
            promise.resolve(success)
        }
    }

    @ReactMethod
    fun typeText(text: String, clearFirst: Boolean, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not enabled")
            return
        }
        val success = service.typeText(text, clearFirst)
        promise.resolve(success)
    }
}
