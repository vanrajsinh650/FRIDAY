package com.friday.voice

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Process
import android.util.Log
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tanh

/**
 * FarFieldAudioPreprocessor — Robust Far-Field Acoustic Engine for Vivo Funtouch OS & Qualcomm HAL.
 *
 * 1. Safe AudioSource selection (VOICE_RECOGNITION -> MIC -> DEFAULT) avoiding UNPROCESSED failures.
 * 2. Strict native AudioRecord resource release on initialization failures to prevent AudioFlinger track leaks.
 * 3. Software Pre-Amp gain booster with tanh soft-limiter for whispered speech capture.
 * 4. Dual-mode VAD (Voiced + Whisper Activity Detector) with dynamic asymmetric noise floor tracking.
 * 5. Thread-safe 3.0s circular pre-roll audio buffer.
 */
class FarFieldAudioPreprocessor {

    companion object {
        private const val TAG = "FarFieldAudioPreprocessor"
    }

    data class AudioFrameFeatures(
        val rmsDb: Float,
        val snrDb: Float,
        val zcr: Float,
        val highFreqRatio: Float,
        val isVoice: Boolean,
        val isWhisper: Boolean,
        val timestamp: Long
    )

    data class VADState(
        val isActive: Boolean = false,
        val isWhisperActive: Boolean = false,
        val confidence: Float = 0f,
        val durationMs: Long = 0,
        val silenceDurationMs: Long = 0,
        val speechSegmentCount: Int = 0
    )

    class CircularShortBuffer(capacity: Int) {
        private val buffer = ShortArray(capacity)
        private var head = 0
        private var count = 0
        private val lock = Any()

        fun write(data: ShortArray, length: Int) {
            synchronized(lock) {
                val len = min(length, data.size)
                for (i in 0 until len) {
                    buffer[head] = data[i]
                    head = (head + 1) % buffer.size
                    if (count < buffer.size) count++
                }
            }
        }

        fun readAll(): ShortArray {
            synchronized(lock) {
                val result = ShortArray(count)
                var idx = 0
                val start = if (count == buffer.size) head else 0
                for (i in 0 until count) {
                    result[idx++] = buffer[(start + i) % buffer.size]
                }
                return result
            }
        }

        fun clear() {
            synchronized(lock) {
                head = 0
                count = 0
            }
        }
    }

    private val recordingLock = Any()
    private var audioRecord: AudioRecord? = null
    private var agc: AutomaticGainControl? = null
    private var aec: AcousticEchoCanceler? = null
    private var ns: NoiseSuppressor? = null

    @Volatile
    private var isRecording = false
    private var audioThread: Thread? = null

    var audioSessionId: Int = 0
        private set

    var currentRmsDb: Float = -100f
        private set
    var currentNoiseFloorDb: Float = -70f
        private set
    var isVoiceActive: Boolean = false
        private set

    var vadState = VADState()
        private set

    // Software Pre-Amp Gain Multiplier (3.5x = ~+11 dB boost for whispers & quiet speech)
    var softwareGainFactor: Float = 3.5f

    // 3.0 seconds pre-roll buffer at 16kHz
    private val preRollBuffer = CircularShortBuffer(48000)

    private var activeFrameCount = 0
    private var silentFrameCount = 0
    private var lastVoiceTimestamp = 0L
    private var lastSilenceTimestamp = 0L

    fun getPreRollAudio(): ShortArray {
        return preRollBuffer.readAll()
    }

    /**
     * Creates an initialized AudioRecord using Vivo / Qualcomm compliant source priority.
     * Priority:
     * 1. VOICE_RECOGNITION (Source 6) — speech/assistant optimized, always permitted by Funtouch OS.
     * 2. MIC (Source 1) — standard mic stream.
     * 3. DEFAULT (Source 0) — universal fallback.
     *
     * Crucial: If any candidate fails initialization, it is immediately released to prevent AudioFlinger track leaks.
     */
    @android.annotation.SuppressLint("MissingPermission")
    private fun createAudioRecord(sampleRate: Int, baseBufferSize: Int): AudioRecord? {
        val audioSources = intArrayOf(
            MediaRecorder.AudioSource.MIC,
            MediaRecorder.AudioSource.DEFAULT,
            MediaRecorder.AudioSource.VOICE_RECOGNITION
        )

        for (attempt in 1..4) {
            for (multiplier in intArrayOf(1, 2, 4)) {
                val bufSize = baseBufferSize * multiplier
                for (source in audioSources) {
                    var record: AudioRecord? = null
                    try {
                        record = AudioRecord(
                            source,
                            sampleRate,
                            AudioFormat.CHANNEL_IN_MONO,
                            AudioFormat.ENCODING_PCM_16BIT,
                            bufSize
                        )
                        if (record.state == AudioRecord.STATE_INITIALIZED) {
                            Log.i(TAG, "AudioRecord initialized successfully with source=$source, bufferSize=$bufSize on attempt=$attempt")
                            return record
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Exception initializing AudioRecord (source=$source): ${e.message}")
                    } finally {
                        if (record != null && record.state != AudioRecord.STATE_INITIALIZED) {
                            try { record.release() } catch (e: Exception) {}
                        }
                        try { Thread.sleep(50) } catch (_: InterruptedException) {}
                    }
                }
            }
            if (attempt < 4) {
                try { Thread.sleep(350) } catch (_: InterruptedException) {}
            }
        }

        Log.e(TAG, "All AudioRecord source candidates failed to initialize after 4 attempts.")
        return null
    }

    fun startListening(
        sampleRate: Int = 16000,
        onAudioChunk: (ShortArray, Int, AudioFrameFeatures) -> Unit
    ) {
        synchronized(recordingLock) {
            if (isRecording) return

            val minBufSize = AudioRecord.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            val bufferSize = max(if (minBufSize > 0) minBufSize * 4 else 8192, 8192)

            val record = createAudioRecord(sampleRate, bufferSize)
            if (record == null || record.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "Failed to start listening: Unable to allocate initialized AudioRecord. Retrying in 1.5s...")
                record?.release()
                Thread {
                    try { Thread.sleep(1500) } catch (_: InterruptedException) {}
                    if (!isRecording) {
                        startListening(sampleRate, onAudioChunk)
                    }
                }.start()
                return
            }

            audioRecord = record

            try {
                val sessionId = record.audioSessionId
                this.audioSessionId = sessionId
                if (sessionId != 0) {
                    try {
                        if (AutomaticGainControl.isAvailable()) {
                            agc = AutomaticGainControl.create(sessionId)?.apply { enabled = true }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "AutomaticGainControl attach failed: ${e.message}")
                    }
                    try {
                        if (AcousticEchoCanceler.isAvailable()) {
                            aec = AcousticEchoCanceler.create(sessionId)?.apply { enabled = true }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "AcousticEchoCanceler attach failed: ${e.message}")
                    }
                    try {
                        if (NoiseSuppressor.isAvailable()) {
                            ns = NoiseSuppressor.create(sessionId)?.apply { enabled = true }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "NoiseSuppressor attach failed: ${e.message}")
                    }
                }

                record.startRecording()
                isRecording = true

                activeFrameCount = 0
                silentFrameCount = 0
                vadState = VADState()
                lastVoiceTimestamp = System.currentTimeMillis()
                lastSilenceTimestamp = System.currentTimeMillis()
                currentNoiseFloorDb = -72f

                Thread({
                    try {
                        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
                    } catch (_: Exception) {}

                    val frameSize = 512 // 32ms frame at 16kHz
                    val rawBuffer = ShortArray(frameSize)
                    val amplifiedBuffer = ShortArray(frameSize)
                    var noiseFloorInitFrames = 0
                    var noiseFloorInitSum = 0f
                    var consecutiveErrors = 0

                    // 2nd-order IIR Butterworth High-Pass Filter (fc=85 Hz, Q=0.707)
                    val fs = sampleRate.toDouble()
                    val fc = 85.0
                    val w0 = 2.0 * PI * fc / fs
                    val alpha = sin(w0) / (2.0 * 0.70710678)
                    val cosW0 = cos(w0)
                    val a0 = 1.0 + alpha
                    val b0 = (1.0 + cosW0) / 2.0 / a0
                    val b1 = -(1.0 + cosW0) / a0
                    val b2 = (1.0 + cosW0) / 2.0 / a0
                    val a1 = (-2.0 * cosW0) / a0
                    val a2 = (1.0 - alpha) / a0

                    var x1 = 0.0
                    var x2 = 0.0
                    var y1 = 0.0
                    var y2 = 0.0

                    while (isRecording && audioRecord != null) {
                        val activeRec = audioRecord ?: break
                        val read = try {
                            activeRec.read(rawBuffer, 0, rawBuffer.size)
                        } catch (e: Exception) {
                            -1
                        }

                        if (read <= 0) {
                            if (!isRecording) break
                            consecutiveErrors++
                            if (consecutiveErrors > 50) {
                                Log.e(TAG, "Too many consecutive AudioRecord read errors ($read). Halting preprocessor.")
                                break
                            }
                            try { Thread.sleep(10) } catch (_: InterruptedException) {}
                            continue
                        }
                        consecutiveErrors = 0

                        // 1. Calculate dynamic gain based on noise floor
                        val gain = when {
                            currentNoiseFloorDb < -75f -> 5.5f
                            currentNoiseFloorDb <= -55f -> 3.5f
                            else -> 1.8f
                        }

                        // 2. Apply HPF and Software Pre-Amp Boost with Smooth Soft-Knee Limiter
                        var energySum = 0.0
                        var zeroCrossings = 0
                        var highFreqEnergy = 0.0
                        val threshold = 24000.0
                        val maxCap = 32767.0
                        val headroom = maxCap - threshold

                        for (i in 0 until read) {
                            val raw = rawBuffer[i].toDouble()
                            
                            // High-pass filter
                            val filtered = b0 * raw + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
                            x2 = x1
                            x1 = raw
                            y2 = y1
                            y1 = filtered
                            
                            val boosted = filtered * gain
                            val absVal = abs(boosted)
                            val saturated = if (absVal > threshold) {
                                val excess = absVal - threshold
                                val compressed = threshold + headroom * tanh(excess / headroom)
                                if (boosted < 0) -compressed else compressed
                            } else {
                                boosted
                            }
                            val sVal = saturated.toInt().coerceIn(-32768, 32767).toShort()
                            amplifiedBuffer[i] = sVal

                            val sample = sVal.toDouble()
                            energySum += sample * sample

                            // Zero Crossing Rate (ZCR)
                            if (i > 0 && ((amplifiedBuffer[i] >= 0 && amplifiedBuffer[i - 1] < 0) ||
                                    (amplifiedBuffer[i] < 0 && amplifiedBuffer[i - 1] >= 0))) {
                                zeroCrossings++
                            }

                            // High-frequency fricative energy approximation
                            if (i > 0) {
                                val diff = (amplifiedBuffer[i] - amplifiedBuffer[i - 1]).toDouble()
                                highFreqEnergy += diff * diff
                            }
                        }

                        preRollBuffer.write(amplifiedBuffer, read)

                        val rms = sqrt(energySum / read)
                        val db = if (rms > 0.0) (20.0 * log10(rms / 32767.0)).toFloat().coerceIn(-100f, 0f) else -100f
                        currentRmsDb = db

                        val zcr = zeroCrossings.toFloat() / read.toFloat()
                        val highFreqRatio = if (energySum > 1.0) (highFreqEnergy / (energySum * 4.0)).toFloat().coerceIn(0f, 1f) else 0f

                        // 2. Dynamic Asymmetric Noise Floor Tracking
                        if (noiseFloorInitFrames < 35) {
                            noiseFloorInitSum += db
                            noiseFloorInitFrames++
                            currentNoiseFloorDb = (noiseFloorInitSum / noiseFloorInitFrames).coerceIn(-90f, -40f)
                        } else {
                            if (db < currentNoiseFloorDb) {
                                currentNoiseFloorDb = (0.85f * currentNoiseFloorDb + 0.15f * db).coerceIn(-90f, -35f)
                            } else {
                                currentNoiseFloorDb = (0.9995f * currentNoiseFloorDb + 0.0005f * db).coerceIn(-90f, -35f)
                            }
                        }

                        // 3. Multi-Feature Dual-Mode VAD (Voiced Speech + Whisper Activity Detector)
                        val snr = currentRmsDb - currentNoiseFloorDb

                        val isNormalVoice = snr >= 2.5f && currentRmsDb > -75.0f && (zcr in 0.015f..0.65f)
                        val isWhisperVoice = snr >= 1.5f && currentRmsDb > -82.0f && (zcr >= 0.12f || highFreqRatio >= 0.25f)

                        val isAudioActive = isNormalVoice || isWhisperVoice

                        val now = System.currentTimeMillis()
                        if (isAudioActive) {
                            activeFrameCount++
                            silentFrameCount = 0
                            if (activeFrameCount >= 2 && !vadState.isActive) {
                                vadState = vadState.copy(
                                    isActive = true,
                                    isWhisperActive = isWhisperVoice && !isNormalVoice,
                                    speechSegmentCount = vadState.speechSegmentCount + 1
                                )
                                lastVoiceTimestamp = now
                            }
                            if (vadState.isActive) {
                                vadState = vadState.copy(
                                    durationMs = now - lastVoiceTimestamp,
                                    silenceDurationMs = 0,
                                    isWhisperActive = vadState.isWhisperActive || isWhisperVoice
                                )
                            }
                        } else {
                            silentFrameCount++
                            activeFrameCount = 0
                            if (silentFrameCount >= 8 && vadState.isActive) {
                                vadState = vadState.copy(isActive = false, isWhisperActive = false)
                                lastSilenceTimestamp = now
                            }
                            if (!vadState.isActive) {
                                vadState = vadState.copy(
                                    silenceDurationMs = now - lastSilenceTimestamp
                                )
                            }
                        }

                        isVoiceActive = vadState.isActive

                        val frameFeatures = AudioFrameFeatures(
                            rmsDb = currentRmsDb,
                            snrDb = snr,
                            zcr = zcr,
                            highFreqRatio = highFreqRatio,
                            isVoice = isVoiceActive,
                            isWhisper = vadState.isWhisperActive,
                            timestamp = now
                        )

                        onAudioChunk(amplifiedBuffer, read, frameFeatures)
                    }
                }, "FRIDAY-AudioPreprocessorThread").apply {
                    audioThread = this
                    start()
                }

            } catch (e: Exception) {
                Log.e(TAG, "Exception during startListening: ${e.message}", e)
                stopListening()
            }
        }
    }

    fun stopListening() {
        synchronized(recordingLock) {
            if (!isRecording && audioRecord == null) return
            isRecording = false

            try {
                audioRecord?.stop()
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping AudioRecord: ${e.message}")
            }

            try {
                if (audioThread != null && Thread.currentThread() != audioThread) {
                    audioThread?.join(300)
                }
            } catch (_: Exception) {}
            audioThread = null

            try {
                agc?.release()
            } catch (_: Exception) {}
            try {
                aec?.release()
            } catch (_: Exception) {}
            try {
                ns?.release()
            } catch (_: Exception) {}
            try {
                audioRecord?.release()
            } catch (e: Exception) {
                Log.w(TAG, "Error releasing AudioRecord: ${e.message}")
            }

            agc = null
            aec = null
            ns = null
            audioRecord = null
        }
    }
}
