package com.friday.accessibility

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class FridayAccessibilityService : AccessibilityService() {

    companion object {
        var instance: FridayAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // No-op: Do not fire IPC calls on every touch/scroll to prevent system-wide lag
    }

    override fun onInterrupt() {
        instance = null
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    fun getScreenTreeJson(): JSONObject {
        val root = rootInActiveWindow ?: return JSONObject()
        val tree = AccessibilityNodeParser.parseNodeTree(root)
        root.recycle()
        return tree
    }

    fun typeText(text: String, clearFirst: Boolean = true): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            ?: findFirstEditableNode(root)
        if (focused == null) {
            root.recycle()
            return false
        }

        try {
            if (clearFirst) {
                val clearArgs = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "")
                }
                focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, clearArgs)
            }

            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        } finally {
            if (focused !== root) {
                focused.recycle()
            }
            root.recycle()
        }
    }

    private fun findFirstEditableNode(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (root.isEditable) return root
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val found = findFirstEditableNode(child)
            if (found != null) {
                if (found !== child) {
                    child.recycle()
                }
                return found
            }
            child.recycle()
        }
        return null
    }

    fun clickNodeByQuery(query: String, matchExact: Boolean = false): Boolean {
        val root = rootInActiveWindow ?: return false
        val lowerQuery = query.lowercase().trim()
        val found = findNodeByTextOrDesc(root, lowerQuery, matchExact)
        if (found != null) {
            var target: AccessibilityNodeInfo? = found
            // Climb up to clickable container if needed
            while (target != null && !target.isClickable) {
                target = target.parent
            }
            if (target != null && target.isClickable) {
                val ok = target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                root.recycle()
                return ok
            }

            // Fallback to tapping coordinates
            val bounds = Rect()
            found.getBoundsInScreen(bounds)
            found.recycle()
            root.recycle()

            if (bounds.width() > 0 && bounds.height() > 0) {
                CoroutineScope(Dispatchers.Main).launch {
                    GestureDispatcher.click(this@FridayAccessibilityService, bounds.centerX().toFloat(), bounds.centerY().toFloat())
                }
                return true
            }
        }
        root.recycle()
        return false
    }

    private fun findNodeByTextOrDesc(node: AccessibilityNodeInfo, query: String, matchExact: Boolean): AccessibilityNodeInfo? {
        val text = node.text?.toString()?.lowercase()
        val desc = node.contentDescription?.toString()?.lowercase()

        val textMatches = if (matchExact) text == query else text?.contains(query) == true
        val descMatches = if (matchExact) desc == query else desc?.contains(query) == true

        if (textMatches || descMatches) {
            return node
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findNodeByTextOrDesc(child, query, matchExact)
            if (found != null) return found
            child.recycle()
        }
        return null
    }

    fun clickFirstResultCard(): Boolean {
        val root = rootInActiveWindow ?: return false
        val card = findFirstCardContainer(root)
        if (card != null) {
            val bounds = Rect()
            card.getBoundsInScreen(bounds)
            
            // Try accessibility action click first
            val actionClicked = if (card.isClickable) card.performAction(AccessibilityNodeInfo.ACTION_CLICK) else false
            card.recycle()
            root.recycle()

            if (actionClicked) return true

            if (bounds.width() > 0 && bounds.height() > 0) {
                CoroutineScope(Dispatchers.Main).launch {
                    GestureDispatcher.click(this@FridayAccessibilityService, bounds.centerX().toFloat(), bounds.centerY().toFloat())
                }
                return true
            }
        }
        root.recycle()

        // Fallback to tapping center of first video card thumbnail (Y = 32% of screen height)
        val metrics = resources.displayMetrics
        val targetX = metrics.widthPixels / 2f
        val targetY = metrics.heightPixels * 0.32f
        CoroutineScope(Dispatchers.Main).launch {
            GestureDispatcher.click(this@FridayAccessibilityService, targetX, targetY)
        }
        return true
    }

    private fun findFirstCardContainer(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)

        val desc = (node.contentDescription ?: "").toString().lowercase()
        val text = (node.text ?: "").toString().lowercase()

        // Look for video elements or large clickable content cards
        val isVideoLike = desc.contains("play") || desc.contains("video") || desc.contains("ago") || desc.contains("views") ||
                text.contains("views") || desc.contains("watch") || desc.contains("channel")

        if (bounds.top > 250 && bounds.top < 1400 && bounds.height() > 120 && bounds.width() > 250) {
            if (node.isClickable || isVideoLike) {
                return node
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findFirstCardContainer(child)
            if (found != null) return found
            child.recycle()
        }
        return null
    }

    fun clickFullScreen(): Boolean {
        val root = rootInActiveWindow ?: return false
        val fsKeywords = listOf("full screen", "fullscreen", "enter full screen", "enter fullscreen", "expand")
        for (kw in fsKeywords) {
            val found = findNodeByTextOrDesc(root, kw, false)
            if (found != null) {
                val bounds = Rect()
                found.getBoundsInScreen(bounds)
                val isClickable = found.isClickable
                val ok = if (isClickable) found.performAction(AccessibilityNodeInfo.ACTION_CLICK) else false
                found.recycle()
                root.recycle()
                if (ok) return true

                if (bounds.width() > 0 && bounds.height() > 0) {
                    CoroutineScope(Dispatchers.Main).launch {
                        GestureDispatcher.click(this@FridayAccessibilityService, bounds.centerX().toFloat(), bounds.centerY().toFloat())
                    }
                    return true
                }
                return false
            }
        }
        root.recycle()

        // Fallback coordinate click for YouTube fullscreen icon:
        // First tap video player to ensure controls are visible (X = 50%, Y = 22%)
        // Then tap bottom-right of video player area (X = 93%, Y = 28%)
        val metrics = resources.displayMetrics
        val playerX = metrics.widthPixels * 0.5f
        val playerY = metrics.heightPixels * 0.22f
        val fsX = metrics.widthPixels * 0.93f
        val fsY = metrics.heightPixels * 0.28f
        CoroutineScope(Dispatchers.Main).launch {
            GestureDispatcher.click(this@FridayAccessibilityService, playerX, playerY)
            kotlinx.coroutines.delay(400)
            GestureDispatcher.click(this@FridayAccessibilityService, fsX, fsY)
        }
        return true
    }

    fun clickSendOrActionButton(): Boolean {
        val root = rootInActiveWindow ?: return false
        val sendKeywords = listOf("send", "send message", "submit", "post", "chat_send_button", "send_button")

        for (kw in sendKeywords) {
            val found = findNodeByTextOrDesc(root, kw, false)
            if (found != null) {
                val bounds = Rect()
                found.getBoundsInScreen(bounds)
                val isClickable = found.isClickable
                val ok = if (isClickable) found.performAction(AccessibilityNodeInfo.ACTION_CLICK) else false
                found.recycle()
                root.recycle()
                if (ok) return true

                if (bounds.width() > 0 && bounds.height() > 0) {
                    CoroutineScope(Dispatchers.Main).launch {
                        GestureDispatcher.click(this@FridayAccessibilityService, bounds.centerX().toFloat(), bounds.centerY().toFloat())
                    }
                    return true
                }
                return false
            }
        }
        root.recycle()

        // Fallback coordinate click for Send button in WhatsApp/Telegram/Messages (bottom right above keyboard / bottom right corner)
        val metrics = resources.displayMetrics
        val sendX = metrics.widthPixels - 80f
        val sendY = metrics.heightPixels - 140f
        CoroutineScope(Dispatchers.Main).launch {
            GestureDispatcher.click(this@FridayAccessibilityService, sendX, sendY)
        }
        return true
    }

    fun pressEnterOrSearch(): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null) {
            val ok = focused.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            focused.recycle()
            root.recycle()
            if (ok) return true
        } else {
            root.recycle()
        }

        // Tap bottom-right keyboard Enter/Search action area
        val metrics = resources.displayMetrics
        val enterX = metrics.widthPixels - 100f
        val enterY = metrics.heightPixels - 100f
        CoroutineScope(Dispatchers.Main).launch {
            GestureDispatcher.click(this@FridayAccessibilityService, enterX, enterY)
        }
        return true
    }
}
