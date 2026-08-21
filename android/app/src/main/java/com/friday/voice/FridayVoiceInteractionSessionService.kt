package com.friday.voice

import android.app.assist.AssistContent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import com.friday.MainActivity

class FridayVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return FridayVoiceInteractionSession(this)
    }
}

class FridayVoiceInteractionSession(private val ctx: Context) : VoiceInteractionSession(ctx) {

    private var overlayLayout: FrameLayout? = null

    override fun onCreate() {
        super.onCreate()
    }

    override fun onCreateContentView(): View {
        val root = FrameLayout(ctx).apply {
            setBackgroundColor(Color.parseColor("#CC070B14"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val hudText = TextView(ctx).apply {
            text = "FRIDAY ASSISTANT ACTIVE\nListening for command..."
            setTextColor(Color.parseColor("#00F0FF"))
            textSize = 18f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        }

        root.addView(hudText)
        overlayLayout = root
        return root
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        // Bring assistant overlay into focus and trigger speech recognition
    }

    override fun onHandleAssist(data: Bundle?, structure: AssistStructure?, content: AssistContent?) {
        super.onHandleAssist(data, structure, content)
        // Extract foreground app metadata for contextual agent reasoning
    }

    override fun onHide() {
        super.onHide()
    }
}
