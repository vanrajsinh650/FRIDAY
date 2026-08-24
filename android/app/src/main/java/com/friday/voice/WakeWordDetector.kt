package com.friday.voice

import android.os.SystemClock
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class WakeWordDetector(
    private var sensitivity: Float = 0.70f,
    private val onWakeDetected: (confidence: Float, latencyMs: Long, preRollAudio: ShortArray?) -> Unit,
    private val onTelemetryUpdate: (rmsDb: Float, noiseFloorDb: Float, isVoice: Boolean, wakeConfidence: Float) -> Unit
) {

    private val preprocessor = FarFieldAudioPreprocessor()
    private var isRunning = false
    private var lastWakeTimestamp = 0L
    private val cooldownMs = 1500L

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
     */
    private fun evaluateWakePattern(
        frames: List<FarFieldAudioPreprocessor.AudioFrameFeatures>,
        durationMs: Long
    ): PatternResult {
        // Minimum frame check (minimum 10 frames = ~320ms)
        if (frames.size < 10) {
            return PatternResult(false, 0f)
        }

        if (durationMs > 2200L || durationMs < 280L) {
            return PatternResult(false, 0f)
        }

        // 1. Duration Score
        val durationScore = when {
            durationMs in 350..1500 -> 1.0f
            durationMs in 280..1900 -> 0.80f
            else -> 0.30f
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

            // Syllable Peak Detection with Adaptive Prominence (>= 1.8 dB peak-valley difference)
            if (i in 1..(frames.size - 2)) {
                val current = rmsValues[i]
                val isPeak = current >= rmsValues[i - 1] && current >= rmsValues[i + 1] && f.snrDb >= 2.0f
                if (isPeak) {
                    peakCount++
                }
            }
        }

        val modulationDepth = maxRms - minRms
        val isWhisperDominant = whisperFrameCount >= (frames.size / 3)

        // Reject weak ambient hum or non-speech background
        if (maxRms < -58.0f && !isWhisperDominant) {
            return PatternResult(false, 0f)
        }

        val avgSnr = sumSnr / frames.size
        if (avgSnr < 2.5f && !isWhisperDominant) {
            return PatternResult(false, 0f)
        }

        // Syllable Envelope Score
        val syllableScore = when {
            peakCount in 2..4 && modulationDepth >= 2.0f -> 1.0f
            peakCount in 1..5 && modulationDepth >= 1.5f -> 0.80f
            isWhisperDominant && peakCount >= 1 -> 0.85f
            peakCount in 1..5 -> 0.50f
            else -> 0.15f
        }

        // 3. Fricative / High-Frequency Phonetic Score (/f/ in "Friday", /h/ in "Hey", /s/ in "Suno")
        val fricativeScore = when {
            maxFricativeRatio >= 0.25f || maxZcr >= 0.16f -> 1.0f
            maxFricativeRatio >= 0.18f || maxZcr >= 0.10f -> 0.75f
            isWhisperDominant -> 0.80f
            else -> 0.35f
        }

        // 4. SNR Strength Score
        val snrScore = if (isWhisperDominant) {
            ((avgSnr - 1.0f) / 10.0f).coerceIn(0.4f, 1.0f)
        } else {
            ((avgSnr - 2.5f) / 12.0f).coerceIn(0.3f, 1.0f)
        }

        // Weighted Composite Acoustic Confidence
        val compositeConfidence = (
            0.25f * durationScore +
            0.35f * syllableScore +
            0.25f * fricativeScore +
            0.15f * snrScore
        ).coerceIn(0.0f, 0.99f)

        // Dynamic threshold mapped from sensitivity (sensitivity 0.65 -> threshold ~0.56)
        val wakeThreshold = (1.0f - sensitivity) * 0.40f + 0.42f

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
