package com.friday.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

object GestureDispatcher {

    suspend fun click(service: AccessibilityService, x: Float, y: Float): Boolean {
        return withTimeoutOrNull(2500L) {
            suspendCancellableCoroutine<Boolean> { continuation ->
                val path = Path().apply { moveTo(x, y) }
                val stroke = GestureDescription.StrokeDescription(path, 0, 50)
                val gesture = GestureDescription.Builder().addStroke(stroke).build()

                val dispatched = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        if (continuation.isActive) continuation.resume(true)
                    }
                    override fun onCancelled(gestureDescription: GestureDescription?) {
                        if (continuation.isActive) continuation.resume(false)
                    }
                }, null)

                if (!dispatched && continuation.isActive) continuation.resume(false)
            }
        } ?: false
    }

    suspend fun longClick(service: AccessibilityService, x: Float, y: Float): Boolean {
        return withTimeoutOrNull(3000L) {
            suspendCancellableCoroutine<Boolean> { continuation ->
                val path = Path().apply { moveTo(x, y) }
                val stroke = GestureDescription.StrokeDescription(path, 0, 750)
                val gesture = GestureDescription.Builder().addStroke(stroke).build()

                val dispatched = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        if (continuation.isActive) continuation.resume(true)
                    }
                    override fun onCancelled(gestureDescription: GestureDescription?) {
                        if (continuation.isActive) continuation.resume(false)
                    }
                }, null)

                if (!dispatched && continuation.isActive) continuation.resume(false)
            }
        } ?: false
    }

    suspend fun swipe(service: AccessibilityService, startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long): Boolean {
        return withTimeoutOrNull(durationMs + 2000L) {
            suspendCancellableCoroutine<Boolean> { continuation ->
                val path = Path().apply {
                    moveTo(startX, startY)
                    lineTo(endX, endY)
                }
                val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
                val gesture = GestureDescription.Builder().addStroke(stroke).build()

                val dispatched = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                    override fun onCompleted(gestureDescription: GestureDescription?) {
                        if (continuation.isActive) continuation.resume(true)
                    }
                    override fun onCancelled(gestureDescription: GestureDescription?) {
                        if (continuation.isActive) continuation.resume(false)
                    }
                }, null)

                if (!dispatched && continuation.isActive) continuation.resume(false)
            }
        } ?: false
    }

    suspend fun scroll(service: AccessibilityService, direction: String): Boolean {
        val displayMetrics = service.resources.displayMetrics
        val width = displayMetrics.widthPixels.toFloat()
        val height = displayMetrics.heightPixels.toFloat()
        val cx = width / 2f
        val cy = height / 2f

        val deltaY = (height * 0.35f).coerceAtLeast(150f)
        val deltaX = (width * 0.35f).coerceAtLeast(150f)

        return when (direction.uppercase()) {
            "UP" -> swipe(service, cx, cy + deltaY, cx, cy - deltaY, 300)
            "DOWN" -> swipe(service, cx, cy - deltaY, cx, cy + deltaY, 300)
            "LEFT" -> swipe(service, cx + deltaX, cy, cx - deltaX, cy, 300)
            "RIGHT" -> swipe(service, cx - deltaX, cy, cx + deltaX, cy, 300)
            else -> swipe(service, cx, cy + deltaY, cx, cy - deltaY, 300)
        }
    }
}
