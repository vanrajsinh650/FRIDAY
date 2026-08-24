package com.friday.fuzzy

import java.util.Locale

class DoubleMetaphone {
    companion object {
        private const val VOWELS = "AEIOUY"
        private val SILENT_START = arrayOf("GN", "KN", "PN", "WR", "PS")
    }

    data class MetaphoneResult(val primary: String, val alternate: String)

    fun encode(input: String?): MetaphoneResult {
        if (input.isNullOrBlank()) return MetaphoneResult("", "")

        val clean = input.uppercase(Locale.US).trim()
            .replace(Regex("[^A-Z]"), "")
        if (clean.isEmpty()) return MetaphoneResult("", "")

        val primary = StringBuilder()
        val alternate = StringBuilder()
        var current = 0
        val length = clean.length

        fun charAt(idx: Int): Char = if (idx in 0 until length) clean[idx] else ' '
        fun stringAt(start: Int, len: Int): String =
            if (start >= 0 && start + len <= length) clean.substring(start, start + len) else ""
        fun isVowel(idx: Int): Boolean = VOWELS.contains(charAt(idx))

        if (SILENT_START.any { clean.startsWith(it) }) {
            current++
        }

        if (charAt(0) == 'X') {
            primary.append('S')
            alternate.append('S')
            current++
        }

        while ((primary.length < 8 || alternate.length < 8) && current < length) {
            when (val c = charAt(current)) {
                'A', 'E', 'I', 'O', 'U', 'Y' -> {
                    if (current == 0) {
                        primary.append('A')
                        alternate.append('A')
                    }
                    current++
                }
                'B' -> {
                    primary.append('P')
                    alternate.append('P')
                    current += if (charAt(current + 1) == 'B') 2 else 1
                }
                'C' -> {
                    if (current > 1 && !isVowel(current - 2) && stringAt(current - 1, 3) == "ACH" &&
                        charAt(current + 2) != 'I' && (charAt(current + 2) != 'E' || stringAt(current - 2, 6) in arrayOf("BACHER", "MACHER"))
                    ) {
                        primary.append('K')
                        alternate.append('K')
                        current += 2
                    } else if (current == 0 && stringAt(current, 6) == "CAESAR") {
                        primary.append('S')
                        alternate.append('S')
                        current += 2
                    } else if (stringAt(current, 2) == "CH") {
                        primary.append('X')
                        alternate.append('K')
                        current += 2
                    } else if (stringAt(current, 2) in arrayOf("CZ", "CS")) {
                        primary.append('S')
                        alternate.append('X')
                        current += 2
                    } else if (stringAt(current, 2) in arrayOf("CI", "CE", "CY")) {
                        primary.append('S')
                        alternate.append('S')
                        current += 2
                    } else {
                        primary.append('K')
                        alternate.append('K')
                        current += if (stringAt(current + 1, 2) in arrayOf(" C", " Q", " G")) 2 else 1
                    }
                }
                'D' -> {
                    if (stringAt(current, 2) == "DG") {
                        if (stringAt(current + 2, 1) in arrayOf("I", "E", "Y")) {
                            primary.append('J')
                            alternate.append('J')
                            current += 3
                        } else {
                            primary.append("TK")
                            alternate.append("TK")
                            current += 2
                        }
                    } else if (stringAt(current, 2) in arrayOf("DT", "DD")) {
                        primary.append('T')
                        alternate.append('T')
                        current += 2
                    } else {
                        primary.append('T')
                        alternate.append('T')
                        current++
                    }
                }
                'F' -> {
                    primary.append('F')
                    alternate.append('F')
                    current += if (charAt(current + 1) == 'F') 2 else 1
                }
                'G' -> {
                    if (charAt(current + 1) == 'H') {
                        if (current > 0 && !isVowel(current - 1)) {
                            primary.append('K')
                            alternate.append('K')
                            current += 2
                        } else if (current == 0) {
                            if (charAt(current + 2) == 'I') {
                                primary.append('J')
                                alternate.append('J')
                            } else {
                                primary.append('K')
                                alternate.append('K')
                            }
                            current += 2
                        } else {
                            current += 2
                        }
                    } else if (charAt(current + 1) == 'N') {
                        primary.append('K')
                        alternate.append('N')
                        current += 2
                    } else if (stringAt(current + 1, 2) == "LI") {
                        primary.append('K')
                        alternate.append('L')
                        current += 2
                    } else if (current == 0 && (charAt(current + 1) == 'Y' || stringAt(current + 1, 2) in arrayOf("ES", "EP", "EB", "EL", "EY", "IB", "IL", "IN", "IE", "EI", "ER"))) {
                        primary.append('K')
                        alternate.append('J')
                        current += 2
                    } else {
                        primary.append('K')
                        alternate.append('J')
                        current += if (charAt(current + 1) == 'G') 2 else 1
                    }
                }
                'H' -> {
                    if ((current == 0 || isVowel(current - 1)) && isVowel(current + 1)) {
                        primary.append('H')
                        alternate.append('H')
                        current += 2
                    } else {
                        current++
                    }
                }
                'J' -> {
                    primary.append('J')
                    alternate.append('A')
                    current += if (charAt(current + 1) == 'J') 2 else 1
                }
                'K' -> {
                    primary.append('K')
                    alternate.append('K')
                    current += if (charAt(current + 1) == 'K') 2 else 1
                }
                'L' -> {
                    primary.append('L')
                    alternate.append('L')
                    current += if (charAt(current + 1) == 'L') 2 else 1
                }
                'M' -> {
                    primary.append('M')
                    alternate.append('M')
                    current += if (charAt(current + 1) == 'M') 2 else 1
                }
                'N' -> {
                    primary.append('N')
                    alternate.append('N')
                    current += if (charAt(current + 1) == 'N') 2 else 1
                }
                'P' -> {
                    if (charAt(current + 1) == 'H') {
                        primary.append('F')
                        alternate.append('F')
                        current += 2
                    } else {
                        primary.append('P')
                        alternate.append('P')
                        current += if (stringAt(current + 1, 1) in arrayOf("P", "B")) 2 else 1
                    }
                }
                'Q' -> {
                    primary.append('K')
                    alternate.append('K')
                    current += if (charAt(current + 1) == 'Q') 2 else 1
                }
                'R' -> {
                    primary.append('R')
                    alternate.append('R')
                    current += if (charAt(current + 1) == 'R') 2 else 1
                }
                'S' -> {
                    if (stringAt(current, 2) == "SH") {
                        primary.append('X')
                        alternate.append('X')
                        current += 2
                    } else if (stringAt(current, 3) in arrayOf("SIO", "SIA")) {
                        primary.append('S')
                        alternate.append('X')
                        current += 3
                    } else {
                        primary.append('S')
                        alternate.append('S')
                        current += if (stringAt(current + 1, 1) in arrayOf("S", "Z")) 2 else 1
                    }
                }
                'T' -> {
                    if (stringAt(current, 4) == "TION" || stringAt(current, 3) in arrayOf("TIA", "TCH")) {
                        primary.append('X')
                        alternate.append('X')
                        current += 3
                    } else if (stringAt(current, 2) == "TH") {
                        primary.append('0')
                        alternate.append('T')
                        current += 2
                    } else {
                        primary.append('T')
                        alternate.append('T')
                        current += if (stringAt(current + 1, 1) in arrayOf("T", "D")) 2 else 1
                    }
                }
                'V' -> {
                    primary.append('F')
                    alternate.append('F')
                    current += if (charAt(current + 1) == 'V') 2 else 1
                }
                'W' -> {
                    if (stringAt(current, 2) == "WR") {
                        primary.append('R')
                        alternate.append('R')
                        current += 2
                    } else if (current == 0 && (isVowel(current + 1) || stringAt(current, 2) == "WH")) {
                        primary.append('A')
                        alternate.append('F')
                        current += 1
                    } else {
                        current++
                    }
                }
                'X' -> {
                    primary.append("KS")
                    alternate.append("KS")
                    current += if (stringAt(current + 1, 1) in arrayOf("C", "X")) 2 else 1
                }
                'Z' -> {
                    primary.append('S')
                    alternate.append('S')
                    current += if (charAt(current + 1) == 'Z') 2 else 1
                }
                else -> current++
            }
        }

        return MetaphoneResult(primary.toString(), alternate.toString())
    }
}
