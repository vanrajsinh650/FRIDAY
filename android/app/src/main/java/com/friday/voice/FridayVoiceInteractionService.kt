package com.friday.voice

import android.content.Intent
import android.service.voice.VoiceInteractionService
import com.friday.services.FridayForegroundService

class FridayVoiceInteractionService : VoiceInteractionService() {

    override fun onReady() {
        super.onReady()
        // Ensure background persistent service is active for continuous listening
        val serviceIntent = Intent(this, FridayForegroundService::class.java)
        startService(serviceIntent)
    }

    override fun onShutdown() {
        super.onShutdown()
    }
}
