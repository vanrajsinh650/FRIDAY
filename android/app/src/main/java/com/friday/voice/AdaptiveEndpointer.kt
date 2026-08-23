package com.friday.voice

enum class EndpointReason {
    SILENCE_AFTER_SPEECH,
    TRANSCRIPT_STABLE,
    MAX_DURATION,
    USER_SIGNAL
}

data class EndpointConfig(
    val minSilenceForShortUtterance: Long = 2500,
    val minSilenceForMediumUtterance: Long = 3200,
    val minSilenceForLongUtterance: Long = 4000,
    val transcriptStabilityWindow: Long = 3000,
    val maxUtteranceDuration: Long = 60000,
    val minSpeechBeforeEndpoint: Long = 500
)

class AdaptiveEndpointer(
    private val config: EndpointConfig = EndpointConfig(),
    private val onEndpointDetected: (EndpointReason) -> Unit
) {
    private var isVoiceActive = false
    private var currentSilenceMs = 0L
    private var sessionStartTime = 0L
    private var totalSpeechDuration = 0L
    private var lastTranscript = ""
    private var lastTranscriptTime = 0L
    private var hasFired = false
    
    fun onVADUpdate(isActive: Boolean, silenceDurationMs: Long, frameDurationMs: Long = 32L) {
        if (hasFired) return
        
        if (sessionStartTime == 0L) {
            sessionStartTime = System.currentTimeMillis()
        }
        
        isVoiceActive = isActive
        currentSilenceMs = silenceDurationMs
        
        if (isActive) {
            totalSpeechDuration += frameDurationMs
        }
        
        checkEndpoint()
    }
    
    fun onTranscriptUpdate(transcript: String) {
        if (hasFired) return
        
        if (transcript != lastTranscript) {
            lastTranscript = transcript
            lastTranscriptTime = System.currentTimeMillis()
        }
        
        checkEndpoint()
    }
    
    fun checkMaxDuration(): Boolean {
        if (hasFired || sessionStartTime == 0L) return false
        
        val duration = System.currentTimeMillis() - sessionStartTime
        if (duration >= config.maxUtteranceDuration) {
            fireEndpoint(EndpointReason.MAX_DURATION)
            return true
        }
        return false
    }
    
    fun hasReachedEndpoint(): Boolean = hasFired
    
    fun reset() {
        isVoiceActive = false
        currentSilenceMs = 0L
        sessionStartTime = 0L
        totalSpeechDuration = 0L
        lastTranscript = ""
        lastTranscriptTime = 0L
        hasFired = false
    }
    
    private fun checkEndpoint() {
        if (hasFired || totalSpeechDuration < config.minSpeechBeforeEndpoint) return
        
        if (checkMaxDuration()) return
        
        // Silence based endpointing
        val wordCount = lastTranscript.split("\\s+".toRegex()).count { it.isNotBlank() }
        
        val requiredSilence = when {
            wordCount < 3 -> config.minSilenceForShortUtterance
            wordCount < 15 -> config.minSilenceForMediumUtterance
            else -> config.minSilenceForLongUtterance
        }
        
        if (!isVoiceActive && currentSilenceMs >= requiredSilence) {
            fireEndpoint(EndpointReason.SILENCE_AFTER_SPEECH)
            return
        }
        
        // Transcript stability endpointing
        if (!isVoiceActive && lastTranscript.isNotBlank() && lastTranscriptTime > 0) {
            val stabilityTime = System.currentTimeMillis() - lastTranscriptTime
            if (stabilityTime >= config.transcriptStabilityWindow && currentSilenceMs >= config.transcriptStabilityWindow) {
                fireEndpoint(EndpointReason.TRANSCRIPT_STABLE)
                return
            }
        }
    }
    
    private fun fireEndpoint(reason: EndpointReason) {
        hasFired = true
        onEndpointDetected(reason)
    }
}
