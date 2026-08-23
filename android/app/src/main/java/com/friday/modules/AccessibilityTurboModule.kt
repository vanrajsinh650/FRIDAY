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

class AccessibilityTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridayAccessibilityNative"

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        val isEnabled = FridayAccessibilityService.instance != null
        promise.resolve(isEnabled)
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = android.content.Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
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
    fun longClickCoordinates(x: Double, y: Double, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not enabled")
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            val success = GestureDispatcher.longClick(service, x.toFloat(), y.toFloat())
            promise.resolve(success)
        }
    }

    @ReactMethod
    fun clickText(query: String, exact: Boolean, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        val ok = service.clickNodeByQuery(query, exact)
        promise.resolve(ok)
    }

    @ReactMethod
    fun clickFirstResultCard(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        val ok = service.clickFirstResultCard()
        promise.resolve(ok)
    }

    @ReactMethod
    fun clickSendOrActionButton(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        val ok = service.clickSendOrActionButton()
        promise.resolve(ok)
    }

    @ReactMethod
    fun clickFullScreen(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        val ok = service.clickFullScreen()
        promise.resolve(ok)
    }

    @ReactMethod
    fun pressEnterOrSearch(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        val ok = service.pressEnterOrSearch()
        promise.resolve(ok)
    }

    @ReactMethod
    fun scroll(direction: String, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            val success = GestureDispatcher.scroll(service, direction)
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

    @ReactMethod
    fun getScreenTree(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not enabled")
            return
        }
        try {
            val json = service.getScreenTreeJson()
            promise.resolve(json.toString())
        } catch (e: Exception) {
            promise.reject("INSPECT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun performGlobalAction(actionName: String, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not enabled")
            return
        }
        val actionId = when (actionName.uppercase()) {
            "BACK" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK
            "HOME" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME
            "RECENTS" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS
            "NOTIFICATIONS" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS
            "QUICK_SETTINGS" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS
            "POWER_DIALOG" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_POWER_DIALOG
            "LOCK_SCREEN" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN
            "TAKE_SCREENSHOT" -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT
            else -> android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK
        }
        val success = service.performGlobalAction(actionId)
        promise.resolve(success)
    }

    @ReactMethod
    fun closeBackgroundApps(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        try {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                val root = service.rootInActiveWindow
                var clicked = false
                if (root != null) {
                    val keywords = listOf("clear all", "close all", "clear", "remove all", "delete all", "clean")
                    for (kw in keywords) {
                        val nodes = root.findAccessibilityNodeInfosByText(kw)
                        if (!nodes.isNullOrEmpty()) {
                            for (node in nodes) {
                                if (node.isClickable) {
                                    node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
                                    clicked = true
                                    break
                                } else if (node.parent?.isClickable == true) {
                                    node.parent.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
                                    clicked = true
                                    break
                                }
                            }
                        }
                        if (clicked) break
                    }
                }
                if (!clicked) {
                    CoroutineScope(Dispatchers.Main).launch {
                        GestureDispatcher.click(service, 540f, 2050f)
                    }
                }
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
                    promise.resolve(true)
                }, 600)
            }, 600)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun closeCurrentApp(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        try {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS)
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    CoroutineScope(Dispatchers.Main).launch {
                        GestureDispatcher.swipe(service, 540f, 1300f, 540f, 300f, 250)
                    }
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
                        promise.resolve(true)
                    }, 400)
                }, 400)
            }, 300)
        } catch (e: Exception) {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun closeSpecificApp(appName: String, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve(false)
            return
        }
        try {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                val root = service.rootInActiveWindow
                var dismissed = false
                if (root != null) {
                    val nodes = root.findAccessibilityNodeInfosByText(appName)
                    if (!nodes.isNullOrEmpty()) {
                        val bounds = android.graphics.Rect()
                        nodes[0].getBoundsInScreen(bounds)
                        val cx = bounds.centerX().toFloat()
                        val cy = bounds.centerY().toFloat()
                        CoroutineScope(Dispatchers.Main).launch {
                            GestureDispatcher.swipe(service, cx, cy, cx, cy - 800f, 250)
                        }
                        dismissed = true
                    }
                }
                if (!dismissed) {
                    CoroutineScope(Dispatchers.Main).launch {
                        GestureDispatcher.swipe(service, 540f, 1300f, 540f, 300f, 250)
                    }
                }
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
                    promise.resolve(true)
                }, 500)
            }, 500)
        } catch (e: Exception) {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun captureScreenBase64(promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.resolve("")
            return
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            try {
                service.takeScreenshot(
                    android.view.Display.DEFAULT_DISPLAY,
                    reactContext.mainExecutor,
                    object : android.accessibilityservice.AccessibilityService.TakeScreenshotCallback {
                        override fun onSuccess(screenshot: android.accessibilityservice.AccessibilityService.ScreenshotResult) {
                            val hardwareBuffer = screenshot.hardwareBuffer
                            val colorSpace = screenshot.colorSpace
                            CoroutineScope(Dispatchers.IO).launch {
                                try {
                                    val bitmap = android.graphics.Bitmap.wrapHardwareBuffer(hardwareBuffer, colorSpace)
                                    if (bitmap != null) {
                                        val softwareBitmap = bitmap.copy(android.graphics.Bitmap.Config.ARGB_8888, false)
                                        val scaled = android.graphics.Bitmap.createScaledBitmap(softwareBitmap, 540, 1200, true)
                                        val stream = java.io.ByteArrayOutputStream()
                                        scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, stream)
                                        val base64 = android.util.Base64.encodeToString(stream.toByteArray(), android.util.Base64.NO_WRAP)
                                        hardwareBuffer.close()
                                        softwareBitmap.recycle()
                                        scaled.recycle()
                                        promise.resolve("data:image/jpeg;base64,$base64")
                                    } else {
                                        hardwareBuffer.close()
                                        promise.resolve("")
                                    }
                                } catch (e: Exception) {
                                    try { hardwareBuffer.close() } catch (_: Exception) {}
                                    promise.resolve("")
                                }
                            }
                        }

                        override fun onFailure(errorCode: Int) {
                            promise.resolve("")
                        }
                    }
                )
            } catch (e: Exception) {
                promise.resolve("")
            }
        } else {
            promise.resolve("")
        }
    }
}
