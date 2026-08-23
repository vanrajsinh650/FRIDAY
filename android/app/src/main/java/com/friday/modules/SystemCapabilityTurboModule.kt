package com.friday.modules

import android.app.admin.DevicePolicyManager
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.friday.accessibility.FridayAccessibilityService

class SystemCapabilityTurboModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FridaySystemCapabilityNative"

    @ReactMethod
    fun getCapabilities(promise: Promise) {
        try {
            val dpm = reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            val isDeviceOwner = dpm?.isDeviceOwnerApp(reactContext.packageName) == true

            val isAccessibilityEnabled = FridayAccessibilityService.instance != null

            // WiFi Capability
            val wifiDirectToggle = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || isDeviceOwner
            val wifiMap = Arguments.createMap().apply {
                putBoolean("read", true)
                putBoolean("directToggle", wifiDirectToggle)
                putBoolean("settingsPanel", true)
                putBoolean("deviceOwnerExempt", isDeviceOwner)
            }

            // Bluetooth Capability
            val btDirectToggle = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || isDeviceOwner
            val btMap = Arguments.createMap().apply {
                putBoolean("read", true)
                putBoolean("directToggle", btDirectToggle)
                putBoolean("settingsPanel", true)
                putBoolean("deviceOwnerExempt", isDeviceOwner)
            }

            // Hotspot Capability
            val hotspotMap = Arguments.createMap().apply {
                putBoolean("read", true)
                putBoolean("directToggle", isDeviceOwner)
                putBoolean("settingsPanel", true)
            }

            val capMap = Arguments.createMap().apply {
                putMap("wifi", wifiMap)
                putMap("bluetooth", btMap)
                putMap("hotspot", hotspotMap)
                putBoolean("accessibility", isAccessibilityEnabled)
                putBoolean("deviceOwner", isDeviceOwner)
                putBoolean("flashlight", true)
                putBoolean("volume", true)
                putBoolean("brightness", Settings.System.canWrite(reactContext))
                putInt("androidApiLevel", Build.VERSION.SDK_INT)
            }

            promise.resolve(capMap)
        } catch (e: Exception) {
            promise.reject("CAPABILITY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getWifiState(promise: Promise) {
        try {
            val wm = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val isEnabled = wm.isWifiEnabled
            val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork
            val caps = cm.getNetworkCapabilities(net)
            val isConnected = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true

            val map = Arguments.createMap().apply {
                putBoolean("enabled", isEnabled)
                putBoolean("connected", isConnected)
                putString("ssid", if (isConnected) wm.connectionInfo.ssid.replace("\"", "") else "")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("WIFI_STATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun toggleWifi(enable: Boolean, promise: Promise) {
        try {
            val dpm = reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            val isDeviceOwner = dpm?.isDeviceOwnerApp(reactContext.packageName) == true

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || isDeviceOwner) {
                @Suppress("DEPRECATION")
                val wm = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                @Suppress("DEPRECATION")
                val ok = wm.setWifiEnabled(enable)
                val res = Arguments.createMap().apply {
                    putBoolean("success", ok)
                    putString("method", "direct_api")
                    putBoolean("directToggle", true)
                    putBoolean("targetState", enable)
                }
                promise.resolve(res)
            } else {
                // Open modern Wi-Fi settings panel
                val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent(Settings.Panel.ACTION_WIFI).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                } else {
                    Intent(Settings.ACTION_WIFI_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                reactContext.startActivity(intent)

                val res = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("method", "settings_panel")
                    putBoolean("directToggle", false)
                    putString("message", "Android requires opening the Wi-Fi panel in normal app mode. Panel opened.")
                }
                promise.resolve(res)
            }
        } catch (e: Exception) {
            promise.reject("WIFI_TOGGLE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getBluetoothState(promise: Promise) {
        try {
            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter
            val isEnabled = adapter?.isEnabled == true

            val map = Arguments.createMap().apply {
                putBoolean("enabled", isEnabled)
                putBoolean("supported", adapter != null)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("BT_STATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun toggleBluetooth(enable: Boolean, promise: Promise) {
        try {
            val dpm = reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            val isDeviceOwner = dpm?.isDeviceOwnerApp(reactContext.packageName) == true

            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter

            if (adapter == null) {
                promise.reject("BT_UNSUPPORTED", "Bluetooth not supported on this device")
                return
            }

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || isDeviceOwner) {
                @Suppress("DEPRECATION")
                val ok = if (enable) adapter.enable() else adapter.disable()
                val res = Arguments.createMap().apply {
                    putBoolean("success", ok)
                    putString("method", "direct_api")
                    putBoolean("directToggle", true)
                }
                promise.resolve(res)
            } else {
                val intent = if (enable) {
                    Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                } else {
                    Intent(Settings.ACTION_BLUETOOTH_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                reactContext.startActivity(intent)

                val res = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("method", "settings_panel")
                    putBoolean("directToggle", false)
                    putString("message", "Opened Bluetooth controls.")
                }
                promise.resolve(res)
            }
        } catch (e: Exception) {
            promise.reject("BT_TOGGLE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun toggleHotspot(enable: Boolean, promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_WIRELESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)

            val res = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("method", "settings_panel")
                putBoolean("directToggle", false)
                putString("message", "Opened Tethering & Portable Hotspot settings.")
            }
            promise.resolve(res)
        } catch (e: Exception) {
            promise.reject("HOTSPOT_ERROR", e.message)
        }
    }
}
