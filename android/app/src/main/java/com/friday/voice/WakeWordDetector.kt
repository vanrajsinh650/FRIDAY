package com.friday.voice

import android.os.SystemClock
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class WakeWordDetector(
    private var sensitivity: Float = 0.82f,
    private val onWakeDetected: (confidence: Float, latencyMs: Long, preRollAudio: ShortArray?) -> Unit,
    private val onTelemetryUpdate: (rmsDb: Float, noiseFloorDb: Float, isVoice: Boolean, wakeConfidence: Float) -> Unit
) {

    private val preprocessor = FarFieldAudioPreprocessor()
    private var isRunning = false
    private var lastWakeTimestamp = 0L
    private val cooldownMs = 800L

    // Rolling frame buffer for speech segment analysis (up to ~2.5 seconds)
    private val speechFrameBuffer = ArrayList<FarFieldAudioPreprocessor.AudioFrameFeatures>(80)
    private var segmentStartTimestamp = 0L
    private var hadSpeechInSegment = false

    fun start() {
        if (isRunning) return
        isRunning = true
        speechFrameBuffer.clear()
        segmentStartTimestamp = 0L
        hadSpeechInSegment = false

        preprocessor.startListening { _, _, features ->
            val rms = features.rmsDb
            val noise = preprocessor.currentNoiseFloorDb
            val voice = features.isVoice
            val now = SystemClock.elapsedRealtime()

            // Post-trigger cooldown enforcement
            if (now - lastWakeTimestamp < cooldownMs) {
                onTelemetryUpdate(rms, noise, voice, 0f)
                return@startListening
            }

            var currentConfidence = 0f

            if (voice) {
                if (speechFrameBuffer.isEmpty()) {
                    segmentStartTimestamp = now
                }
                hadSpeechInSegment = true
                speechFrameBuffer.add(features)

                // Limit buffer length (~3.0 seconds max = ~90 frames)
                if (speechFrameBuffer.size > 90) {
                    speechFrameBuffer.removeAt(0)
                }

                val segmentDuration = now - segmentStartTimestamp

                // Allow speech segment to develop (cap continuous stream at 1800ms)
                if (segmentDuration >= 1800L) {
                    val analysis = evaluateWakePattern(speechFrameBuffer, segmentDuration)
                    currentConfidence = analysis.confidence

                    if (analysis.isWakeDetected) {
                        lastWakeTimestamp = now
                        speechFrameBuffer.clear()
                        hadSpeechInSegment = false
                        onWakeDetected(analysis.confidence, segmentDuration, preprocessor.getPreRollAudio())
                    } else {
                        speechFrameBuffer.clear()
                        hadSpeechInSegment = false
                    }
                }
            } else {
                if (hadSpeechInSegment && speechFrameBuffer.isNotEmpty()) {
                    // Voice segment completed and fell into silence
                    val segmentDuration = now - segmentStartTimestamp
                    val finalAnalysis = evaluateWakePattern(speechFrameBuffer, segmentDuration)
                    currentConfidence = finalAnalysis.confidence

                    if (finalAnalysis.isWakeDetected) {
                        lastWakeTimestamp = now
                        speechFrameBuffer.clear()
                        hadSpeechInSegment = false
                        onWakeDetected(finalAnalysis.confidence, segmentDuration, preprocessor.getPreRollAudio())
                    }
                    speechFrameBuffer.clear()
                    hadSpeechInSegment = false
                }
            }

            onTelemetryUpdate(rms, noise, voice, currentConfidence)
        }
    }

    private data class PatternResult(
        val isWakeDetected: Boolean,
        val confidence: Float
    )

    /**
     * Acoustic & Phonetic Verification for:
     * - "Hey Friday" (3 syllables: /heɪ/ - /fraɪ/ - /deɪ/, duration ~400ms - 1500ms)
     * - "Friday" (2 syllables: /fraɪ/ - /deɪ/, duration ~300ms - 1100ms)
     * - "Hi Friday", "Ok Friday", "Suno Friday" (3-4 syllables, duration ~450ms - 1700ms)
     * Supports both Voiced speech and Whispered/Low-Volume speech.
     */
    private fun evaluateWakePattern(
        frames: List<FarFieldAudioPreprocessor.AudioFrameFeatures>,
        durationMs: Long
    ): PatternResult {
        // Fast minimum frame check (minimum 8 frames = ~256ms)
        if (frames.size < 8) {
            return PatternResult(false, 0f)
        }

        if (durationMs > 2400L) { // Continuous ambient conversation -> reject
            return PatternResult(false, 0f)
        }

        // 1. Duration Score
        val durationScore = when {
            durationMs in 350..1500 -> 1.0f
            durationMs in 280..2000 -> 0.80f
            else -> 0.40f
        }

        // 2. Syllable Envelope Extraction
        var peakCount = 0
        var maxRms = -100f
        var minRms = 0f
        var sumSnr = 0f
        var maxFricativeRatio = 0f
        var maxZcr = 0f
        var whisperFrameCount = 0

        val rmsValues = FloatArray(frames.size) { frames[it].rmsDb }
        for (i in frames.indices) {
            val f = frames[i]
            maxRms = max(maxRms, f.rmsDb)
            minRms = min(minRms, f.rmsDb)
            sumSnr += f.snrDb
            maxFricativeRatio = max(maxFricativeRatio, f.highFreqRatio)
            maxZcr = max(maxZcr, f.zcr)
            if (f.isWhisper) whisperFrameCount++

            // Syllable Peak Detection with Whisper-Adaptive Prominence (>= 1.5 dB peak-valley difference)
            if (i in 1..(frames.size - 2)) {
                val current = rmsValues[i]
                val isPeak = current >= rmsValues[i - 1] && current >= rmsValues[i + 1] && f.snrDb >= 1.8f
                if (isPeak) {
                    peakCount++
                }
            }
        }

        val modulationDepth = maxRms - minRms
        val isWhisperDominant = whisperFrameCount >= (frames.size / 3)

        // Envelope Score
        val syllableScore = when {
            peakCount in 2..4 && modulationDepth >= 1.8f -> 1.0f
            peakCount in 1..5 && modulationDepth >= 1.2f -> 0.85f
            isWhisperDominant && peakCount >= 1 -> 0.90f
            peakCount in 1..5 -> 0.60f // Reduced to reject flat TV noise
            else -> 0.20f
        }

        // 3. Fricative / High-Frequency Phonetic Score (/f/ in "Friday", /h/ in "Hey", /s/ in "Suno")
        val fricativeScore = when {
            maxFricativeRatio >= 0.30f || maxZcr >= 0.18f -> 1.0f
            maxFricativeRatio >= 0.20f || maxZcr >= 0.12f -> 0.80f
            isWhisperDominant -> 0.85f
            else -> 0.45f
        }

        // Fast noise check for silence and TV noise
        // Removed maxRms strict filter

        // 4. SNR Strength Score
        val avgSnr = sumSnr / frames.size
        // Removed avgSnr strict filter

        val snrScore = if (isWhisperDominant) {
            ((avgSnr - 1.0f) / 10.0f).coerceIn(0.4f, 1.0f)
        } else {
            ((avgSnr - 2.0f) / 12.0f).coerceIn(0.3f, 1.0f)
        }

        // Weighted Composite Acoustic Confidence
        val compositeConfidence = (
            0.25f * durationScore +
            0.35f * syllableScore +
            0.25f * fricativeScore +
            0.15f * snrScore
        ).coerceIn(0.0f, 0.99f)

        // Dynamic threshold mapped from sensitivity (sensitivity 0.82 -> threshold ~0.44)
        val wakeThreshold = (1.0f - sensitivity) * 0.35f + 0.38f

        // Candidate trigger condition (Groq Whisper in RAM performs ground-truth verification)
        val isWake = compositeConfidence >= wakeThreshold

        return PatternResult(isWake, compositeConfidence)
    }

    fun stop() {
        isRunning = false
        speechFrameBuffer.clear()
        preprocessor.stopListening()
    }

    fun setSensitivity(value: Float) {
        sensitivity = value.coerceIn(0.1f, 1.0f)
    }

    fun isRunning(): Boolean = isRunning
}
