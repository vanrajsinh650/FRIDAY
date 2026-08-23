package com.friday.voice

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionService

import android.speech.SpeechRecognizer

class FridayRecognitionService : RecognitionService() {

    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        try {
            listener?.readyForSpeech(Bundle())
        } catch (_: Exception) {}
    }

    override fun onCancel(listener: Callback?) {
        try {
            listener?.error(SpeechRecognizer.ERROR_CLIENT)
        } catch (_: Exception) {}
    }

    override fun onStopListening(listener: Callback?) {
        try {
            listener?.endOfSpeech()
        } catch (_: Exception) {}
    }
}
