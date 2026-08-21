package com.friday

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.friday.modules.FridayPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = false

        override fun getPackages(): List<ReactPackage> {
            return listOf(FridayPackage())
        }

        override fun getJSMainModuleName(): String = "index"

        override val isNewArchEnabled: Boolean = false
        override val isHermesEnabled: Boolean = false
    }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
    }
}
