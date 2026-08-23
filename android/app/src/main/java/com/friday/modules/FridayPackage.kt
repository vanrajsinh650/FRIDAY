package com.friday.modules

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class FridayPackage : ReactPackage {
    companion object {
        var currentReactContext: ReactApplicationContext? = null
            private set
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        currentReactContext = reactContext
        return listOf(
            AccessibilityTurboModule(reactContext),
            SystemControlTurboModule(reactContext),
            SystemCapabilityTurboModule(reactContext),
            SpeechRecognizerTurboModule(reactContext),
            TTSTurboModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> {
        return emptyList()
    }
}
