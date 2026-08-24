package com.friday.fuzzy

import java.util.Locale
import kotlin.math.max
import kotlin.math.min

object FuzzyMatcher {

    private val doubleMetaphone = DoubleMetaphone()

    fun soundex(input: String): String {
        if (input.isBlank()) return ""
        val clean = input.uppercase(Locale.US).replace(Regex("[^A-Z]"), "")
        if (clean.isEmpty()) return ""

        val out = StringBuilder().append(clean[0])
        var lastCode = getSoundexCode(clean[0])

        for (i in 1 until clean.length) {
            val code = getSoundexCode(clean[i])
            if (code != '0' && code != lastCode) {
                out.append(code)
            }
            if (code != '.') {
                lastCode = code
            }
            if (out.length == 4) break
        }
        while (out.length < 4) out.append('0')
        return out.toString()
    }

    private fun getSoundexCode(c: Char): Char = when (c) {
        'B', 'F', 'P', 'V' -> '1'
        'C', 'G', 'J', 'K', 'Q', 'S', 'X', 'Z' -> '2'
        'D', 'T' -> '3'
        'L' -> '4'
        'M', 'N' -> '5'
        'R' -> '6'
        'H', 'W' -> '.'
        else -> '0'
    }

    fun getDoubleMetaphone(input: String): DoubleMetaphone.MetaphoneResult {
        return doubleMetaphone.encode(input)
    }

    fun damerauLevenshteinDistance(s1: String, s2: String): Int {
        val len1 = s1.length
        val len2 = s2.length
        if (len1 == 0) return len2
        if (len2 == 0) return len1

        val d = Array(len1 + 1) { IntArray(len2 + 1) }

        for (i in 0..len1) d[i][0] = i
        for (j in 0..len2) d[0][j] = j

        for (i in 1..len1) {
            for (j in 1..len2) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                d[i][j] = min(
                    min(d[i - 1][j] + 1, d[i][j - 1] + 1),
                    d[i - 1][j - 1] + cost
                )
                if (i > 1 && j > 1 && s1[i - 1] == s2[j - 2] && s1[i - 2] == s2[j - 1]) {
                    d[i][j] = min(d[i][j], d[i - 2][j - 2] + cost)
                }
            }
        }
        return d[len1][len2]
    }

    fun jaroWinkler(s1: String, s2: String): Double {
        if (s1 == s2) return 1.0
        if (s1.isEmpty() || s2.isEmpty()) return 0.0

        val matchDistance = max(s1.length, s2.length) / 2 - 1
        val s1Matches = BooleanArray(s1.length)
        val s2Matches = BooleanArray(s2.length)

        var matches = 0
        for (i in s1.indices) {
            val start = max(0, i - matchDistance)
            val end = min(i + matchDistance + 1, s2.length)

            for (j in start until end) {
                if (s2Matches[j] || s1[i] != s2[j]) continue
                s1Matches[i] = true
                s2Matches[j] = true
                matches++
                break
            }
        }

        if (matches == 0) return 0.0

        var transpositions = 0
        var k = 0
        for (i in s1.indices) {
            if (!s1Matches[i]) continue
            while (!s2Matches[k]) k++
            if (s1[i] != s2[k]) transpositions++
            k++
        }

        val m = matches.toDouble()
        val jaro = (m / s1.length + m / s2.length + (m - transpositions / 2.0) / m) / 3.0

        var prefix = 0
        for (i in 0 until min(4, min(s1.length, s2.length))) {
            if (s1[i] == s2[i]) prefix++ else break
        }

        return jaro + prefix * 0.1 * (1.0 - jaro)
    }

    fun tokenSortRatio(s1: String, s2: String): Double {
        val t1 = s1.lowercase(Locale.US).split(Regex("\\s+")).filter { it.isNotBlank() }.sorted().joinToString(" ")
        val t2 = s2.lowercase(Locale.US).split(Regex("\\s+")).filter { it.isNotBlank() }.sorted().joinToString(" ")
        return jaroWinkler(t1, t2)
    }
}
