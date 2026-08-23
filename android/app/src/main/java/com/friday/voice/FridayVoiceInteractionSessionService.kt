package com.friday.voice

import android.app.assist.AssistContent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.friday.MainActivity

class FridayVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return FridayVoiceInteractionSession(this)
    }
}

class FridayVoiceInteractionSession(private val ctx: Context) : VoiceInteractionSession(ctx) {

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        // Launch FRIDAY's main activity with voice trigger — this replaces the Google Assistant flow
        try {
            val intent = Intent(ctx, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("TRIGGER_VOICE_SESSION", true)
            }
            ctx.startActivity(intent)
        } catch (_: Exception) {}
        // Dismiss the voice interaction overlay immediately so FRIDAY's own UI takes over
        hide()
    }

    override fun onHandleAssist(data: Bundle?, structure: AssistStructure?, content: AssistContent?) {
        super.onHandleAssist(data, structure, content)
    }

    override fun onCreateContentView(): View {
        // Return a transparent empty view — FRIDAY's own UI handles everything
        return FrameLayout(ctx).apply {
            layoutParams = ViewGroup.LayoutParams(0, 0)
        }
    }

    override fun onHide() {
        super.onHide()
    }
}
