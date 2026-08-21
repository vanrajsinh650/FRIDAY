package com.friday.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCancellableCoroutine

object GestureDispatcher {

    suspend fun click(service: AccessibilityService, x: Float, y: Float): Boolean {
        return suspendCancellableCoroutine { continuation ->
            val path = Path().apply { moveTo(x, y) }
            val stroke = GestureDescription.StrokeDescription(path, 0, 50)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()

            val dispatched = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    continuation.resume(true)
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    continuation.resume(false)
                }
            }, null)

            if (!dispatched) continuation.resume(false)
        }
    }

    suspend fun swipe(service: AccessibilityService, startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long): Boolean {
        return suspendCancellableCoroutine { continuation ->
            val path = Path().apply {
                moveTo(startX, startY)
                lineTo(endX, endY)
            }
            val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()

            val dispatched = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    continuation.resume(true)
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    continuation.resume(false)
                }
            }, null)

            if (!dispatched) continuation.resume(false)
        }
    }
}
