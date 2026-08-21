package com.friday.modules

import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.UUID

class TTSTurboModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var initPromise: Promise? = null

    init {
        tts = TextToSpeech(reactContext, this)
    }

    override fun getName(): String = "FridayTTSNative"

    private fun sendEvent(eventName: String, params: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.US
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    val params = Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                    }
                    sendEvent("onTTSStart", params)
                }

                override fun onDone(utteranceId: String?) {
                    val params = Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                    }
                    sendEvent("onTTSDone", params)
                }

                override fun onError(utteranceId: String?) {
                    val params = Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                        putString("error", "TTS synthesis error")
                    }
                    sendEvent("onTTSError", params)
                }
            })
            isInitialized = true
            initPromise?.resolve(true)
        } else {
            isInitialized = false
            initPromise?.reject("TTS_INIT_FAILED", "Failed to initialize Android TextToSpeech engine")
        }
        initPromise = null
    }

    @ReactMethod
    fun speak(text: String, rate: Double, pitch: Double, promise: Promise) {
        if (!isInitialized || tts == null) {
            promise.reject("TTS_NOT_INITIALIZED", "TextToSpeech engine is not initialized yet")
            return
        }

        try {
            tts?.setSpeechRate(rate.toFloat().coerceIn(0.5f, 2.0f))
            tts?.setPitch(pitch.toFloat().coerceIn(0.5f, 2.0f))

            val utteranceId = UUID.randomUUID().toString()
            val params = Bundle().apply {
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            }

            val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
            if (result == TextToSpeech.SUCCESS) {
                promise.resolve(utteranceId)
            } else {
                promise.reject("TTS_SPEAK_FAILED", "Failed to enqueue speech utterance")
            }
        } catch (e: Exception) {
            promise.reject("TTS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            tts?.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TTS_STOP_ERROR", e.message)
        }
    }
}
