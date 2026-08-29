package com.friday.modules

import android.graphics.Bitmap
import android.os.Build
import android.util.Base64
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.friday.accessibility.FridayAccessibilityService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream

class ScreenCaptureTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridayScreenCaptureNative"

    @ReactMethod
    fun captureScreenshot(quality: Double, maxWidth: Double, promise: Promise) {
        val service = FridayAccessibilityService.instance
        if (service == null) {
            promise.reject("ACCESSIBILITY_DISABLED", "FridayAccessibilityService is not running")
            return
        }

        val q = if (quality in 1.0..100.0) quality.toInt() else 75
        val maxW = if (maxWidth > 100.0) maxWidth.toInt() else 720

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                service.takeScreenshot(
                    Display.DEFAULT_DISPLAY,
                    reactContext.mainExecutor,
                    object : android.accessibilityservice.AccessibilityService.TakeScreenshotCallback {
                        override fun onSuccess(screenshot: android.accessibilityservice.AccessibilityService.ScreenshotResult) {
                            val hardwareBuffer = screenshot.hardwareBuffer
                            val colorSpace = screenshot.colorSpace
                            CoroutineScope(Dispatchers.IO).launch {
                                try {
                                    val bitmap = Bitmap.wrapHardwareBuffer(hardwareBuffer, colorSpace)
                                    if (bitmap != null) {
                                        val softwareBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, false)
                                        val origW = softwareBitmap.width
                                        val origH = softwareBitmap.height

                                        val scale = if (origW > maxW) maxW.toFloat() / origW else 1.0f
                                        val targetW = (origW * scale).toInt()
                                        val targetH = (origH * scale).toInt()

                                        val scaled = if (scale < 1.0f) {
                                            Bitmap.createScaledBitmap(softwareBitmap, targetW, targetH, true)
                                        } else {
                                            softwareBitmap
                                        }

                                        val stream = ByteArrayOutputStream()
                                        scaled.compress(Bitmap.CompressFormat.JPEG, q, stream)
                                        val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)

                                        hardwareBuffer.close()
                                        if (scaled != softwareBitmap) {
                                            scaled.recycle()
                                        }
                                        softwareBitmap.recycle()

                                        val map: WritableMap = Arguments.createMap().apply {
                                            putString("base64", "data:image/jpeg;base64,$base64")
                                            putInt("width", targetW)
                                            putInt("height", targetH)
                                        }
                                        promise.resolve(map)
                                    } else {
                                        hardwareBuffer.close()
                                        promise.reject("CAPTURE_FAILED", "Failed to wrap hardware buffer")
                                    }
                                } catch (e: Exception) {
                                    try { hardwareBuffer.close() } catch (_: Exception) {}
                                    promise.reject("CAPTURE_ERROR", e.message)
                                }
                            }
                        }

                        override fun onFailure(errorCode: Int) {
                            promise.reject("CAPTURE_ERROR", "takeScreenshot failed with error code: $errorCode")
                        }
                    }
                )
            } catch (e: Exception) {
                promise.reject("CAPTURE_EXCEPTION", e.message)
            }
        } else {
            promise.reject("UNSUPPORTED_VERSION", "Android 11+ (API 30+) required for Accessibility takeScreenshot")
        }
    }
}
