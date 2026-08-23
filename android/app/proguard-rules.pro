# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
   @com.facebook.react.bridge.ReactMethod *;
}

# FRIDAY Native Modules & Services
-keep class com.friday.** { *; }
-keepclassmembers class com.friday.** { *; }

# OkHttp & Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Coroutines
-keepclassmembers class kotlinx.coroutines.** { *; }
