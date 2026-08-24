package com.friday.services

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.friday.MainActivity
import com.friday.modules.FridayPackage
import kotlin.math.abs

/**
 * FridayFloatingOverlayService — Persistent 24/7 Holographic Floating HUD
 *
 * Renders a compact, draggable Glowing Holographic Pill / Orb HUD on top of all screens
 * when third-party apps (YouTube, WhatsApp, Settings, etc.) are in the foreground.
 *
 * Features:
 * 1. Compact draggable Holographic Pill / Orb HUD via WindowManager TYPE_APPLICATION_OVERLAY.
 * 2. Real-time dynamic state ("Listening...", "Thinking...", "Opening YouTube...", "Playing video...", "Verified ✓").
 * 3. Quick Mic Tap to trigger voice capture and instant Close ('✕') button.
 * 4. Tap HUD body to bring FRIDAY back to the foreground.
 * 5. Full thread safety and zero WindowManager leak lifecycle management.
 */
class FridayFloatingOverlayService : Service() {

    companion object {
        private const val TAG = "FridayOverlayService"
        private const val CHANNEL_ID = "FridayFloatingOverlayHUD"
        private const val NOTIFICATION_ID = 102

        const val ACTION_SHOW = "com.friday.action.SHOW_OVERLAY"
        const val ACTION_UPDATE = "com.friday.action.UPDATE_OVERLAY"
        const val ACTION_HIDE = "com.friday.action.HIDE_OVERLAY"

        const val EXTRA_STATUS_TEXT = "extra_status_text"
        const val EXTRA_STATE = "extra_state"

        var instance: FridayFloatingOverlayService? = null
            private set

        fun show(context: Context, statusText: String = "Online & Listening", state: String = "IDLE") {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
                    Log.w(TAG, "Cannot show overlay: SYSTEM_ALERT_WINDOW permission not granted")
                    return
                }
                val intent = Intent(context, FridayFloatingOverlayService::class.java).apply {
                    action = ACTION_SHOW
                    putExtra(EXTRA_STATUS_TEXT, statusText)
                    putExtra(EXTRA_STATE, state)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed starting FridayFloatingOverlayService: ${e.message}")
            }
        }

        fun update(statusText: String, state: String = "EXECUTING") {
            instance?.updateState(statusText, state)
        }

        fun hide(context: Context? = null) {
            val ctx = context ?: instance
            if (instance != null) {
                instance?.hideOverlayView()
            } else if (ctx != null) {
                try {
                    val intent = Intent(ctx, FridayFloatingOverlayService::class.java).apply {
                        action = ACTION_HIDE
                    }
                    ctx.startService(intent)
                } catch (_: Exception) {}
            }
        }

        fun isShowing(): Boolean = instance?.isViewAttached == true
    }

    private var windowManager: WindowManager? = null
    private var overlayLayout: LinearLayout? = null
    private var orbView: View? = null
    private var statusTextView: TextView? = null
    private var micButton: TextView? = null
    private var closeButton: TextView? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var isViewAttached = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pulseAnimator: ObjectAnimator? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        createNotificationChannel()
        startForegroundNotification()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_SHOW
        val statusText = intent?.getStringExtra(EXTRA_STATUS_TEXT) ?: "Online & Listening"
        val state = intent?.getStringExtra(EXTRA_STATE) ?: "IDLE"

        when (action) {
            ACTION_SHOW -> {
                showOverlayView(statusText, state)
            }
            ACTION_UPDATE -> {
                updateState(statusText, state)
            }
            ACTION_HIDE -> {
                hideOverlayView()
            }
        }

        return START_NOT_STICKY
    }

    private fun dpToPx(dp: Float): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            resources.displayMetrics
        ).toInt()
    }

    fun showOverlayView(statusText: String, state: String) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post { showOverlayView(statusText, state) }
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not granted")
            return
        }

        if (overlayLayout == null) {
            buildOverlayView()
        }

        updateState(statusText, state)

        if ((!isViewAttached || overlayLayout?.isAttachedToWindow != true) && overlayLayout != null && windowManager != null) {
            try {
                if (overlayLayout?.isAttachedToWindow != true) {
                    windowManager?.addView(overlayLayout, layoutParams)
                }
                isViewAttached = true
                Log.i(TAG, "Floating HUD successfully added to WindowManager")
            } catch (e: Exception) {
                Log.e(TAG, "Error adding overlay view to WindowManager: ${e.message}")
            }
        }
    }

    private fun buildOverlayView() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(14f), dpToPx(8f), dpToPx(12f), dpToPx(8f))

            // Holographic Dark Glass Background with Cyan Neon Stroke
            val backgroundDrawable = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(24f).toFloat()
                setColor(Color.parseColor("#E6081320")) // Deep dark glass HUD
                setStroke(dpToPx(1.5f), Color.parseColor("#00E5FF")) // Glowing Cyan Arc Reactor Border
            }
            background = backgroundDrawable
            elevation = dpToPx(8f).toFloat()
        }

        // 1. Glowing Holographic Orb / Status Dot
        val orb = View(this).apply {
            val orbSize = dpToPx(12f)
            layoutParams = LinearLayout.LayoutParams(orbSize, orbSize).apply {
                gravity = Gravity.CENTER_VERTICAL
                marginEnd = dpToPx(10f)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#00E5FF"))
            }
        }
        orbView = orb
        root.addView(orb)

        // Pulsing breathing animation for the orb
        pulseAnimator?.cancel()
        val scaleX = PropertyValuesHolder.ofFloat(View.SCALE_X, 1.0f, 1.35f)
        val scaleY = PropertyValuesHolder.ofFloat(View.SCALE_Y, 1.0f, 1.35f)
        pulseAnimator = ObjectAnimator.ofPropertyValuesHolder(orb, scaleX, scaleY).apply {
            duration = 900
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.REVERSE
        }
        pulseAnimator?.start()

        // 2. Status / Activity Live Text
        val textView = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_VERTICAL
                marginEnd = dpToPx(12f)
            }
            setTextColor(Color.parseColor("#F0FDFA"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f)
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            maxLines = 1
            maxWidth = dpToPx(200f)
            setSingleLine(true)
            ellipsize = android.text.TextUtils.TruncateAt.END
            text = "FRIDAY Active"
        }
        statusTextView = textView
        root.addView(textView)

        // 3. Quick Mic Tap Button (🎤)
        val mic = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_VERTICAL
                marginEnd = dpToPx(10f)
            }
            text = "🎤"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding(dpToPx(6f), dpToPx(4f), dpToPx(6f), dpToPx(4f))
            setTextColor(Color.parseColor("#00E5FF"))
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(12f).toFloat()
                setColor(Color.parseColor("#3300E5FF"))
            }
            setOnClickListener {
                triggerMicAction()
            }
        }
        micButton = mic
        root.addView(mic)

        // 4. Quick Close Button (✕)
        val close = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_VERTICAL
            }
            text = "✕"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(dpToPx(6f), dpToPx(4f), dpToPx(6f), dpToPx(4f))
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            setOnClickListener {
                hideOverlayView()
            }
        }
        closeButton = close
        root.addView(close)

        // 5. Dragging & Touch Handling
        setupTouchListener(root)

        // WindowManager Layout Params
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dpToPx(24f)
            y = dpToPx(100f)
        }

        overlayLayout = root
    }

    private fun setupTouchListener(root: LinearLayout) {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var touchStartTime = 0L
        var isDragging = false

        root.setOnTouchListener { _, event ->
            val params = layoutParams ?: return@setOnTouchListener false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    touchStartTime = System.currentTimeMillis()
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (abs(dx) > dpToPx(5f) || abs(dy) > dpToPx(5f)) {
                        isDragging = true
                    }
                    params.x = initialX + dx
                    params.y = initialY + dy
                    if (isViewAttached && overlayLayout?.isAttachedToWindow == true) {
                        try {
                            windowManager?.updateViewLayout(overlayLayout, params)
                        } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val totalDx = abs(event.rawX - initialTouchX)
                    val totalDy = abs(event.rawY - initialTouchY)
                    val elapsed = System.currentTimeMillis() - touchStartTime

                    // If tap on HUD body (not dragging and short duration): bring FRIDAY app to foreground
                    if (!isDragging && totalDx < dpToPx(8f) && totalDy < dpToPx(8f) && elapsed < 350) {
                        bringAppToForeground()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun triggerMicAction() {
        try {
            sendEventToJS("onAppVoiceTrigger", Arguments.createMap().apply {
                putBoolean("triggerVoice", true)
            })
            FridayForegroundService.startActiveQuery()
            updateState("Listening...", "LISTENING")
        } catch (e: Exception) {
            Log.e(TAG, "Error triggering mic action: ${e.message}")
        }
    }

    private fun bringAppToForeground() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed bringing MainActivity to foreground: ${e.message}")
        }
    }

    private fun sendEventToJS(eventName: String, params: Any?) {
        try {
            var reactCtx: ReactContext? = FridayForegroundService.activeReactContext
            if (reactCtx == null || !reactCtx.hasActiveReactInstance()) {
                reactCtx = FridayPackage.currentReactContext
            }
            reactCtx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed emitting event '$eventName' to JS: ${e.message}")
        }
    }

    fun updateState(statusText: String?, state: String?) {
        val text = statusText ?: "FRIDAY Active"
        val st = state ?: "IDLE"

        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post { updateState(text, st) }
            return
        }

        statusTextView?.text = text

        val colorHex = when (st.uppercase()) {
            "LISTENING" -> "#00E5FF" // Glowing Electric Cyan
            "THINKING", "PLANNING" -> "#F59E0B" // Amber Gold
            "EXECUTING", "RUNNING" -> "#38BDF8" // Neon Sky Blue
            "SPEAKING" -> "#818CF8" // Neon Indigo
            "VERIFYING" -> "#14B8A6" // Teal
            "SUCCESS", "COMPLETED" -> "#10B981" // Emerald Green
            "ERROR", "FAILED" -> "#EF4444" // Crimson Red
            else -> "#00E5FF"
        }

        try {
            (orbView?.background as? GradientDrawable)?.setColor(Color.parseColor(colorHex))
            ((overlayLayout?.background as? GradientDrawable))?.setStroke(
                dpToPx(1.5f),
                Color.parseColor(colorHex)
            )
        } catch (_: Exception) {}

        if (st.equals("SUCCESS", ignoreCase = true) || st.equals("COMPLETED", ignoreCase = true)) {
            // Auto-dismiss HUD 7s after task success
            mainHandler.removeCallbacks(autoHideRunnable)
            mainHandler.postDelayed(autoHideRunnable, 7000)
        } else {
            mainHandler.removeCallbacks(autoHideRunnable)
        }
    }

    private val autoHideRunnable = Runnable {
        hideOverlayView()
    }

    fun hideOverlayView() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post { hideOverlayView() }
            return
        }

        mainHandler.removeCallbacks(autoHideRunnable)
        if ((isViewAttached || overlayLayout?.isAttachedToWindow == true) && overlayLayout != null && windowManager != null) {
            try {
                windowManager?.removeView(overlayLayout)
                isViewAttached = false
                Log.i(TAG, "Floating HUD removed from WindowManager")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing overlay view: ${e.message}")
                isViewAttached = false
            }
        }
    }

    private fun startForegroundNotification() {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            tapIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FRIDAY Holographic HUD")
            .setContentText("Persistent 24/7 Screen Overlay Active")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, 0)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed starting foreground notification with type, attempting fallback: ${e.message}")
            try {
                startForeground(NOTIFICATION_ID, notification)
            } catch (_: Exception) {}
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "FRIDAY Floating HUD Service",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Persistent Holographic Floating Pill Overlay"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        hideOverlayView()
        pulseAnimator?.cancel()
        pulseAnimator = null
        mainHandler.removeCallbacksAndMessages(null)
        if (instance == this) {
            instance = null
        }
    }
}
