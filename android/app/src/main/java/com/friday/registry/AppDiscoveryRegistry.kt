package com.friday.registry

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import com.friday.fuzzy.FuzzyMatcher
import kotlinx.coroutines.*
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

data class AppMetadata(
    val appName: String,
    val packageName: String,
    val activityName: String,
    val normalizedName: String,
    val tokens: Set<String>,
    val soundexCodes: Set<String>,
    val metaphoneCodes: Set<String>,
    val isSystemApp: Boolean,
    val genericRoles: Set<String>
)

data class MatchResult(
    val app: AppMetadata,
    val score: Double,
    val matchType: String
)

class AppDiscoveryRegistry private constructor(private val context: Context) {

    companion object {
        private const val TAG = "AppDiscoveryRegistry"
        @Volatile
        private var INSTANCE: AppDiscoveryRegistry? = null

        fun getInstance(context: Context): AppDiscoveryRegistry {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: AppDiscoveryRegistry(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private val appMap = ConcurrentHashMap<String, AppMetadata>() // Key: packageName
    private val normalizedIndex = ConcurrentHashMap<String, MutableSet<String>>()
    private val phoneticIndex = ConcurrentHashMap<String, MutableSet<String>>()
    private val tokenIndex = ConcurrentHashMap<String, MutableSet<String>>()
    private val roleIndex = ConcurrentHashMap<String, MutableSet<String>>()

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    init {
        reloadApps()
    }

    @Synchronized
    fun reloadApps() {
        scope.launch {
            try {
                val pm = context.packageManager
                val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                }

                val resolveInfos: List<ResolveInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(mainIntent, PackageManager.ResolveInfoFlags.of(0))
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(mainIntent, 0)
                }

                val systemRoles = discoverSystemRoles(pm)

                val tempAppMap = ConcurrentHashMap<String, AppMetadata>()
                val tempNormalized = ConcurrentHashMap<String, MutableSet<String>>()
                val tempPhonetic = ConcurrentHashMap<String, MutableSet<String>>()
                val tempTokens = ConcurrentHashMap<String, MutableSet<String>>()
                val tempRoles = ConcurrentHashMap<String, MutableSet<String>>()

                for (info in resolveInfos) {
                    val pkg = info.activityInfo.packageName
                    val activity = info.activityInfo.name
                    val rawLabel = info.loadLabel(pm).toString()
                    val normalized = normalizeString(rawLabel)

                    val isSystem = (info.activityInfo.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0

                    val tokens = mutableSetOf<String>()
                    tokens.addAll(normalized.split(Regex("[^a-z0-9]+")).filter { it.isNotBlank() })

                    val pkgParts = pkg.split(".").filter { part ->
                        part !in setOf("com", "android", "google", "app", "apps", "mobile", "client") && part.length > 1
                    }
                    tokens.addAll(pkgParts)

                    val soundexSet = mutableSetOf<String>()
                    val metaphoneSet = mutableSetOf<String>()

                    soundexSet.add(FuzzyMatcher.soundex(normalized))
                    val dm = FuzzyMatcher.getDoubleMetaphone(normalized)
                    if (dm.primary.isNotBlank()) metaphoneSet.add(dm.primary)
                    if (dm.alternate.isNotBlank()) metaphoneSet.add(dm.alternate)

                    for (token in tokens) {
                        soundexSet.add(FuzzyMatcher.soundex(token))
                        val tokenDm = FuzzyMatcher.getDoubleMetaphone(token)
                        if (tokenDm.primary.isNotBlank()) metaphoneSet.add(tokenDm.primary)
                        if (tokenDm.alternate.isNotBlank()) metaphoneSet.add(tokenDm.alternate)
                    }

                    val appRoles = systemRoles[pkg] ?: emptySet()

                    val app = AppMetadata(
                        appName = rawLabel,
                        packageName = pkg,
                        activityName = activity,
                        normalizedName = normalized,
                        tokens = tokens,
                        soundexCodes = soundexSet,
                        metaphoneCodes = metaphoneSet,
                        isSystemApp = isSystem,
                        genericRoles = appRoles
                    )

                    tempAppMap[pkg] = app

                    tempNormalized.getOrPut(normalized) { ConcurrentHashMap.newKeySet() }.add(pkg)
                    tempNormalized.getOrPut(pkg.lowercase(Locale.US)) { ConcurrentHashMap.newKeySet() }.add(pkg)

                    for (token in tokens) {
                        tempTokens.getOrPut(token) { ConcurrentHashMap.newKeySet() }.add(pkg)
                    }
                    for (meta in metaphoneSet) {
                        tempPhonetic.getOrPut(meta) { ConcurrentHashMap.newKeySet() }.add(pkg)
                    }
                    for (sound in soundexSet) {
                        tempPhonetic.getOrPut(sound) { ConcurrentHashMap.newKeySet() }.add(pkg)
                    }
                    for (role in appRoles) {
                        tempRoles.getOrPut(role) { ConcurrentHashMap.newKeySet() }.add(pkg)
                    }
                }

                appMap.clear()
                appMap.putAll(tempAppMap)

                normalizedIndex.clear()
                normalizedIndex.putAll(tempNormalized)

                phoneticIndex.clear()
                phoneticIndex.putAll(tempPhonetic)

                tokenIndex.clear()
                tokenIndex.putAll(tempTokens)

                roleIndex.clear()
                roleIndex.putAll(tempRoles)

                Log.d(TAG, "Indexed ${appMap.size} apps successfully.")
            } catch (e: Exception) {
                Log.e(TAG, "Error reloading installed apps", e)
            }
        }
    }

    private fun discoverSystemRoles(pm: PackageManager): Map<String, Set<String>> {
        val roleMap = mutableMapOf<String, MutableSet<String>>()

        fun mapIntentToRole(intent: Intent, roleName: String) {
            try {
                val resolveList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(intent, 0)
                }
                for (res in resolveList) {
                    val pkg = res.activityInfo.packageName
                    roleMap.getOrPut(pkg) { mutableSetOf() }.add(roleName)
                }
            } catch (_: Exception) {}
        }

        mapIntentToRole(Intent(MediaStore.ACTION_IMAGE_CAPTURE), "camera")
        mapIntentToRole(Intent(Intent.ACTION_DIAL), "phone")
        mapIntentToRole(Intent(Intent.ACTION_DIAL), "dialer")
        mapIntentToRole(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("geo:0,0?q=")), "maps")
        mapIntentToRole(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://google.com")), "browser")
        mapIntentToRole(Intent(Intent.ACTION_SENDTO, android.net.Uri.parse("smsto:")), "messages")
        mapIntentToRole(Intent(Intent.ACTION_SENDTO, android.net.Uri.parse("smsto:")), "sms")

        return roleMap
    }

    fun onPackageAddedOrUpdated(packageName: String) {
        Log.d(TAG, "Package added/updated: $packageName. Refreshing index...")
        reloadApps()
    }

    fun onPackageRemoved(packageName: String) {
        Log.d(TAG, "Package removed: $packageName. Evicting from index...")
        appMap.remove(packageName)
        reloadApps()
    }

    fun getAllApps(): List<AppMetadata> = appMap.values.toList()

    fun findBestMatch(rawQuery: String): MatchResult? {
        val query = normalizeString(rawQuery)
        if (query.isBlank()) return null

        // TIER 1: Exact Normalized Match
        normalizedIndex[query]?.let { pkgSet ->
            pkgSet.firstOrNull()?.let { appMap[it] }?.let {
                return MatchResult(it, 1.0, "EXACT_NAME")
            }
        }

        // TIER 2: Generic Role Match (e.g. "camera", "browser")
        roleIndex[query]?.let { pkgSet ->
            pkgSet.firstOrNull()?.let { appMap[it] }?.let {
                return MatchResult(it, 0.98, "GENERIC_ROLE")
            }
        }

        // TIER 3: Exact Token Match (e.g. "play store" -> token "store")
        val queryTokens = query.split(Regex("[^a-z0-9]+")).filter { it.isNotBlank() }
        if (queryTokens.isNotEmpty()) {
            tokenIndex[query]?.let { pkgSet ->
                pkgSet.firstOrNull()?.let { appMap[it] }?.let {
                    return MatchResult(it, 0.95, "EXACT_TOKEN")
                }
            }
        }

        // TIER 4: Phonetic Match (Double Metaphone + Soundex)
        val queryDm = FuzzyMatcher.getDoubleMetaphone(query)
        val querySoundex = FuzzyMatcher.soundex(query)

        val phoneticCandidates = mutableSetOf<String>()
        if (queryDm.primary.isNotBlank()) phoneticIndex[queryDm.primary]?.let { phoneticCandidates.addAll(it) }
        if (queryDm.alternate.isNotBlank()) phoneticIndex[queryDm.alternate]?.let { phoneticCandidates.addAll(it) }
        phoneticIndex[querySoundex]?.let { phoneticCandidates.addAll(it) }

        if (phoneticCandidates.isNotEmpty()) {
            var bestPhonetic: AppMetadata? = null
            var bestPhoneticScore = 0.0

            for (pkg in phoneticCandidates) {
                val app = appMap[pkg] ?: continue
                val score = FuzzyMatcher.jaroWinkler(query, app.normalizedName)
                if (score > bestPhoneticScore) {
                    bestPhoneticScore = score
                    bestPhonetic = app
                }
            }

            if (bestPhonetic != null && bestPhoneticScore >= 0.70) {
                return MatchResult(bestPhonetic, 0.90 + (bestPhoneticScore * 0.05), "PHONETIC_MATCH")
            }
        }

        // TIER 5: Prefix Match
        for (app in appMap.values) {
            if (app.normalizedName.startsWith(query)) {
                return MatchResult(app, 0.88, "PREFIX_MATCH")
            }
        }

        // TIER 6: Exhaustive Fuzzy Composite Match (TokenSort + JaroWinkler + DamerauLevenshtein)
        var bestApp: AppMetadata? = null
        var maxScore = 0.0

        for (app in appMap.values) {
            val tokenSort = FuzzyMatcher.tokenSortRatio(query, app.normalizedName)
            val jaro = FuzzyMatcher.jaroWinkler(query, app.normalizedName)

            val dist = FuzzyMatcher.damerauLevenshteinDistance(query, app.normalizedName)
            val maxLen = maxOf(query.length, app.normalizedName.length)
            val levScore = if (maxLen > 0) 1.0 - (dist.toDouble() / maxLen) else 0.0

            val compositeScore = (tokenSort * 0.4) + (jaro * 0.35) + (levScore * 0.25)

            if (compositeScore > maxScore) {
                maxScore = compositeScore
                bestApp = app
            }
        }

        return if (bestApp != null && maxScore >= 0.65) {
            MatchResult(bestApp, maxScore, "FUZZY_COMPOSITE")
        } else {
            null
        }
    }

    private fun normalizeString(input: String): String {
        return input.lowercase(Locale.US)
            .replace(Regex("['’]"), "")
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .trim()
            .replace(Regex("\\s+"), " ")
    }
}
