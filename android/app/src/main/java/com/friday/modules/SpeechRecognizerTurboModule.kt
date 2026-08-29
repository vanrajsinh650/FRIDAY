package com.friday.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.friday.services.FridayForegroundService

class SpeechRecognizerTurboModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        FridayForegroundService.activeReactContext = reactContext
        FridayForegroundService.ensureStarted(reactContext)
        com.friday.MainActivity.flushPendingVoiceIntent()
    }

    override fun getName(): String = "FridaySpeechRecognizerNative"

    @ReactMethod
    fun addListener(type: String?) {}

    @ReactMethod
    fun removeListeners(type: Double?) {}

    @ReactMethod
    fun setApiKey(apiKey: String?, promise: Promise) {
        if (!apiKey.isNullOrBlank()) {
            FridayForegroundService.groqApiKey = apiKey
            try {
                reactContext.getSharedPreferences("friday_prefs", android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putString("groq_api_key", apiKey)
                    .apply()
            } catch (_: Exception) {}
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun setApiKeys(groqKey1: String?, groqKey2: String?, groqKey3: String?, openaiKey: String?, promise: Promise) {
        if (!groqKey1.isNullOrBlank()) FridayForegroundService.groqApiKey = groqKey1
        if (!groqKey2.isNullOrBlank()) FridayForegroundService.groqApiKey2 = groqKey2
        if (!groqKey3.isNullOrBlank()) FridayForegroundService.groqApiKey3 = groqKey3
        if (!openaiKey.isNullOrBlank()) FridayForegroundService.openaiApiKey = openaiKey
        try {
            reactContext.getSharedPreferences("friday_prefs", android.content.Context.MODE_PRIVATE)
                .edit()
                .apply {
                    if (!groqKey1.isNullOrBlank()) putString("groq_api_key", groqKey1)
                    if (!groqKey2.isNullOrBlank()) putString("groq_api_key_2", groqKey2)
                    if (!groqKey3.isNullOrBlank()) putString("groq_api_key_3", groqKey3)
                    if (!openaiKey.isNullOrBlank()) putString("openai_api_key", openaiKey)
                }
                .apply()
        } catch (_: Exception) {}
        promise.resolve(true)
    }

    @ReactMethod
    fun startListening(language: String?, promise: Promise) {
        FridayForegroundService.activeReactContext = reactContext
        FridayForegroundService.ensureStarted(reactContext)
        FridayForegroundService.startActiveQuery(language)
        promise.resolve(true)
    }

    @ReactMethod
    fun startContinuousWakeListening(promise: Promise) {
        FridayForegroundService.activeReactContext = reactContext
        FridayForegroundService.ensureStarted(reactContext)
        FridayForegroundService.resumeWakeLoop()
        com.friday.MainActivity.flushPendingVoiceIntent()
        promise.resolve(true)
    }

    @ReactMethod
    fun stopContinuousWakeListening(promise: Promise) {
        FridayForegroundService.pauseWakeLoop()
        FridayForegroundService.stopForegroundService(reactContext)
        promise.resolve(true)
    }

    @ReactMethod
    fun setAssistantEnabled(enabled: Boolean, promise: Promise) {
        FridayForegroundService.setGloballyEnabled(reactContext, enabled)
        promise.resolve(true)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        FridayForegroundService.stopActiveQuery()
        promise.resolve(true)
    }

    @ReactMethod
    fun cancelListening(promise: Promise) {
        FridayForegroundService.cancelActiveQuery()
        promise.resolve(true)
    }
}
