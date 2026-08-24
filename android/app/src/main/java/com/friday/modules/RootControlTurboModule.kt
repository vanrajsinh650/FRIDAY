package com.friday.modules

import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import rikka.shizuku.Shizuku
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class RootControlTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "FridayRootControlNative"
        private const val SHIZUKU_PERMISSION_REQUEST_CODE = 4001
        private const val SHELL_TIMEOUT_MS = 15000L
        private const val PERMISSION_TIMEOUT_MS = 30000L

        private val PACKAGE_NAME_REGEX = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")
        private val PERMISSION_REGEX = Regex("^[a-zA-Z0-9_]+(\\.[a-zA-Z0-9_]+)+$")

        private val SU_BINARY_PATHS = arrayOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/data/local/su"
        )
    }

    override fun getName(): String = MODULE_NAME

    private fun safeResolve(promise: Promise, value: Any?) {
        try {
            promise.resolve(value)
        } catch (_: Throwable) {}
    }

    private fun destroyProcessSafely(process: Process) {
        try { process.inputStream.close() } catch (_: Throwable) {}
        try { process.errorStream.close() } catch (_: Throwable) {}
        try { process.outputStream.close() } catch (_: Throwable) {}
        try {
            process.destroy()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                process.destroyForcibly()
            }
        } catch (_: Throwable) {}
    }

    private fun checkShizukuAvailable(): Boolean {
        return try {
            Shizuku.pingBinder()
        } catch (_: Throwable) {
            false
        }
    }

    private fun checkShizukuPermission(): Boolean {
        return try {
            if (!checkShizukuAvailable()) return false
            if (Shizuku.isPreV11()) return false
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        } catch (_: Throwable) {
            false
        }
    }

    private fun checkRootAvailable(): Boolean {
        for (path in SU_BINARY_PATHS) {
            try {
                if (File(path).exists()) return true
            } catch (_: Throwable) {}
        }
        var process: Process? = null
        return try {
            process = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val curProcess = process
            val completed = runBlocking {
                withTimeoutOrNull(2000L) {
                    val stdoutDrain = async(Dispatchers.IO) {
                        try { curProcess?.inputStream?.bufferedReader()?.use { it.readText() } } catch (_: Throwable) { "" }
                    }
                    val stderrDrain = async(Dispatchers.IO) {
                        try { curProcess?.errorStream?.bufferedReader()?.use { it.readText() } } catch (_: Throwable) { "" }
                    }
                    stdoutDrain.await()
                    stderrDrain.await()
                    curProcess?.waitFor() ?: -1
                }
            } ?: -1
            completed == 0
        } catch (_: Throwable) {
            false
        } finally {
            process?.let { destroyProcessSafely(it) }
        }
    }

    private fun createProcess(command: String, isShizuku: Boolean): Process {
        if (isShizuku) {
            try {
                val method = Shizuku::class.java.getDeclaredMethod(
                    "newProcess",
                    Array<String>::class.java,
                    Array<String>::class.java,
                    String::class.java
                )
                method.isAccessible = true
                return method.invoke(null, arrayOf("sh", "-c", command), null, null) as Process
            } catch (_: Throwable) {
                // Fallback to su if Shizuku reflection fails
            }
        }
        return Runtime.getRuntime().exec(arrayOf("su", "-c", command))
    }

    @ReactMethod
    fun isShizukuAvailable(promise: Promise) {
        safeResolve(promise, checkShizukuAvailable())
    }

    @ReactMethod
    fun hasShizukuPermission(promise: Promise) {
        safeResolve(promise, checkShizukuPermission())
    }

    @ReactMethod
    fun requestShizukuPermission(promise: Promise) {
        val resolved = AtomicBoolean(false)
        fun resolveOnce(result: Boolean) {
            if (resolved.compareAndSet(false, true)) {
                safeResolve(promise, result)
            }
        }

        try {
            if (!checkShizukuAvailable()) {
                resolveOnce(false)
                return
            }
            if (checkShizukuPermission()) {
                resolveOnce(true)
                return
            }

            var permListener: Shizuku.OnRequestPermissionResultListener? = null
            var binderDeadListener: Shizuku.OnBinderDeadListener? = null

            fun cleanup() {
                permListener?.let {
                    try { Shizuku.removeRequestPermissionResultListener(it) } catch (_: Throwable) {}
                }
                binderDeadListener?.let {
                    try { Shizuku.removeBinderDeadListener(it) } catch (_: Throwable) {}
                }
            }

            permListener = Shizuku.OnRequestPermissionResultListener { requestCode, grantResult ->
                if (requestCode == SHIZUKU_PERMISSION_REQUEST_CODE) {
                    val granted = grantResult == PackageManager.PERMISSION_GRANTED
                    cleanup()
                    resolveOnce(granted)
                }
            }

            binderDeadListener = Shizuku.OnBinderDeadListener {
                cleanup()
                resolveOnce(false)
            }

            Shizuku.addRequestPermissionResultListener(permListener)
            Shizuku.addBinderDeadListener(binderDeadListener)
            Shizuku.requestPermission(SHIZUKU_PERMISSION_REQUEST_CODE)

            // Watchdog timer in case Shizuku manager dialog hangs or dismisses without callback
            CoroutineScope(Dispatchers.IO).launch {
                delay(PERMISSION_TIMEOUT_MS)
                if (!resolved.get()) {
                    cleanup()
                    resolveOnce(false)
                }
            }
        } catch (_: Throwable) {
            resolveOnce(false)
        }
    }

    @ReactMethod
    fun isRootAvailable(promise: Promise) {
        safeResolve(promise, checkRootAvailable())
    }

    @ReactMethod
    fun getElevatedStatus(promise: Promise) {
        val shizukuAvail = checkShizukuAvailable()
        val shizukuPerm = checkShizukuPermission()
        val rootAvail = checkRootAvailable()
        val elevatedAvail = shizukuPerm || rootAvail

        val tier = when {
            shizukuPerm -> "SHIZUKU"
            rootAvail -> "ROOT"
            else -> "NONE"
        }

        val map = Arguments.createMap().apply {
            putBoolean("shizukuAvailable", shizukuAvail)
            putBoolean("shizukuPermission", shizukuPerm)
            putBoolean("rootAvailable", rootAvail)
            putBoolean("elevatedAvailable", elevatedAvail)
            putString("activeTier", tier)
        }
        safeResolve(promise, map)
    }

    @ReactMethod
    fun executeElevatedShell(command: String?, promise: Promise) {
        if (command.isNullOrBlank()) {
            val map = Arguments.createMap().apply {
                putBoolean("success", false)
                putString("stdout", "")
                putString("stderr", "Command cannot be null or empty.")
                putInt("exitCode", -1)
                putString("error", "INVALID_COMMAND")
            }
            safeResolve(promise, map)
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            var process: Process? = null
            try {
                val shizukuPerm = checkShizukuPermission()
                val rootAvail = checkRootAvailable()

                if (!shizukuPerm && !rootAvail) {
                    val map = Arguments.createMap().apply {
                        putBoolean("success", false)
                        putString("stdout", "")
                        putString("stderr", "ELEVATED_UNAVAILABLE: Neither Shizuku permission nor SU binary is available.")
                        putInt("exitCode", -1)
                        putString("error", "ELEVATED_UNAVAILABLE")
                    }
                    withContext(Dispatchers.Main) {
                        safeResolve(promise, map)
                    }
                    return@launch
                }

                process = createProcess(command, shizukuPerm)

                val curProcess = process ?: throw IllegalStateException("Failed to create process")

                val timedOut = withTimeoutOrNull(SHELL_TIMEOUT_MS) {
                    val stdoutDeferred = async(Dispatchers.IO) {
                        try {
                            curProcess.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                        } catch (_: Throwable) { "" }
                    }
                    val stderrDeferred = async(Dispatchers.IO) {
                        try {
                            curProcess.errorStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                        } catch (_: Throwable) { "" }
                    }

                    val stdout = stdoutDeferred.await()
                    val stderr = stderrDeferred.await()
                    val exitCode = curProcess.waitFor()

                    val map = Arguments.createMap().apply {
                        putBoolean("success", exitCode == 0)
                        putString("stdout", stdout.trim())
                        putString("stderr", stderr.trim())
                        putInt("exitCode", exitCode)
                        if (exitCode != 0) {
                            putString("error", "Process exited with code $exitCode: ${stderr.trim()}")
                        }
                    }
                    map
                }

                if (timedOut != null) {
                    withContext(Dispatchers.Main) {
                        safeResolve(promise, timedOut)
                    }
                } else {
                    val map = Arguments.createMap().apply {
                        putBoolean("success", false)
                        putString("stdout", "")
                        putString("stderr", "Execution timed out after ${SHELL_TIMEOUT_MS}ms")
                        putInt("exitCode", -1)
                        putString("error", "TIMEOUT")
                    }
                    withContext(Dispatchers.Main) {
                        safeResolve(promise, map)
                    }
                }
            } catch (e: Throwable) {
                withContext(Dispatchers.Main) {
                    val map = Arguments.createMap().apply {
                        putBoolean("success", false)
                        putString("stdout", "")
                        putString("stderr", e.message ?: "Execution error")
                        putInt("exitCode", -1)
                        putString("error", e.message ?: "EXECUTION_FAILED")
                    }
                    safeResolve(promise, map)
                }
            } finally {
                process?.let { destroyProcessSafely(it) }
            }
        }
    }

    @ReactMethod
    fun inputTap(x: Double, y: Double, promise: Promise) {
        if (x.isNaN() || y.isNaN() || x.isInfinite() || y.isInfinite() || x < 0.0 || y < 0.0 || x > 10000.0 || y > 10000.0) {
            safeResolve(promise, false)
            return
        }
        val command = "input tap ${x.toInt()} ${y.toInt()}"
        executeCommandAndResolveBoolean(command, promise)
    }

    @ReactMethod
    fun inputText(text: String?, promise: Promise) {
        if (text == null) {
            safeResolve(promise, false)
            return
        }
        if (text.isEmpty()) {
            safeResolve(promise, true)
            return
        }
        // Sanitize control characters and newlines to prevent command injection
        val sanitized = text.replace(Regex("[\\x00-\\x1F\\x7F]"), " ")
        val escaped = sanitized.replace("'", "'\\''")
        val command = "input text '$escaped'"
        executeCommandAndResolveBoolean(command, promise)
    }

    @ReactMethod
    fun inputKey(keyCode: Int, promise: Promise) {
        if (keyCode < 0 || keyCode > 1000) {
            safeResolve(promise, false)
            return
        }
        val command = "input keyevent $keyCode"
        executeCommandAndResolveBoolean(command, promise)
    }

    @ReactMethod
    fun killProcess(packageName: String?, promise: Promise) {
        if (packageName.isNullOrBlank() || !PACKAGE_NAME_REGEX.matches(packageName.trim())) {
            safeResolve(promise, false)
            return
        }
        val command = "am force-stop ${packageName.trim()}"
        executeCommandAndResolveBoolean(command, promise)
    }

    @ReactMethod
    fun grantPermission(packageName: String?, permission: String?, promise: Promise) {
        if (packageName.isNullOrBlank() || permission.isNullOrBlank() ||
            !PACKAGE_NAME_REGEX.matches(packageName.trim()) ||
            !PERMISSION_REGEX.matches(permission.trim())) {
            safeResolve(promise, false)
            return
        }
        val command = "pm grant ${packageName.trim()} ${permission.trim()}"
        executeCommandAndResolveBoolean(command, promise)
    }

    private fun executeCommandAndResolveBoolean(command: String, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            var process: Process? = null
            try {
                val shizukuPerm = checkShizukuPermission()
                val rootAvail = checkRootAvailable()

                if (!shizukuPerm && !rootAvail) {
                    withContext(Dispatchers.Main) {
                        safeResolve(promise, false)
                    }
                    return@launch
                }

                process = createProcess(command, shizukuPerm)

                val curProcess = process ?: throw IllegalStateException("Failed to create process")

                val exitCode = withTimeoutOrNull(SHELL_TIMEOUT_MS) {
                    val stdoutDrain = async(Dispatchers.IO) {
                        try { curProcess.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() } } catch (_: Throwable) { "" }
                    }
                    val stderrDrain = async(Dispatchers.IO) {
                        try { curProcess.errorStream.bufferedReader(Charsets.UTF_8).use { it.readText() } } catch (_: Throwable) { "" }
                    }
                    stdoutDrain.await()
                    stderrDrain.await()
                    curProcess.waitFor()
                } ?: -1

                withContext(Dispatchers.Main) {
                    safeResolve(promise, exitCode == 0)
                }
            } catch (_: Throwable) {
                withContext(Dispatchers.Main) {
                    safeResolve(promise, false)
                }
            } finally {
                process?.let { destroyProcessSafely(it) }
            }
        }
    }
}
