package com.friday

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.friday.modules.FridayPackage
import com.friday.services.FridayForegroundService

class MainActivity : ReactActivity() {
    companion object {
        var pendingVoiceTrigger: Boolean = false
        var pendingVoiceCommand: String? = null

        fun flushPendingVoiceIntent() {
            val reactContext = FridayPackage.currentReactContext
            if (reactContext != null && reactContext.hasActiveReactInstance() && (pendingVoiceTrigger || !pendingVoiceCommand.isNullOrBlank())) {
                try {
                    val params = Arguments.createMap().apply {
                        putBoolean("triggerVoice", pendingVoiceTrigger)
                        putString("command", pendingVoiceCommand ?: "")
                    }
                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onAppVoiceTrigger", params)
                    pendingVoiceTrigger = false
                    pendingVoiceCommand = null
                } catch (_: Exception) {}
            }
        }
    }

    override fun getMainComponentName(): String = "FRIDAY"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleVoiceIntent(intent)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        requestRequiredPermissions()
        FridayForegroundService.ensureStarted(this)
        handleVoiceIntent(intent)
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_CONTACTS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CALL_PHONE)
        }
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 1001)
        }
    }

    override fun onResume() {
        super.onResume()
        flushPendingVoiceIntent()
    }

    override fun onPause() {
        super.onPause()
        // Critical for 24/7 background screen watching & assistant operation:
        // When user is in another app (like YouTube or WhatsApp), keep React Native's JS runtime alive so Friday can observe the screen, speak TTS, and execute multi-turn commands!
        if (FridayForegroundService.instance != null) {
            try {
                reactNativeHost.reactInstanceManager.onHostResume(this, null)
            } catch (_: Exception) {}
        }
    }

    private fun handleVoiceIntent(intent: Intent?) {
        if (intent == null) return
        var triggerVoice = intent.getBooleanExtra("TRIGGER_VOICE_SESSION", false)
        val voiceCommand = intent.getStringExtra("VOICE_COMMAND")

        // Detect when launched via default assistant trigger (long-press home, voice button, etc.)
        val action = intent.action
        if (action == Intent.ACTION_ASSIST ||
            action == Intent.ACTION_VOICE_COMMAND ||
            action == Intent.ACTION_SEARCH_LONG_PRESS ||
            action == "android.intent.action.VOICE_ASSIST") {
            triggerVoice = true
        }

        // Clear intent extras immediately so they never re-trigger on subsequent app switches
        intent.removeExtra("TRIGGER_VOICE_SESSION")
        intent.removeExtra("VOICE_COMMAND")
        setIntent(Intent(this, MainActivity::class.java))

        if (triggerVoice || !voiceCommand.isNullOrBlank()) {
            pendingVoiceTrigger = triggerVoice
            pendingVoiceCommand = voiceCommand
            flushPendingVoiceIntent()
        }
    }
}
