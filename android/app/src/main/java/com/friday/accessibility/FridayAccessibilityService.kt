package com.friday.accessibility

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Build
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

    fun triggerCameraShutter(): Boolean {
        val root = rootInActiveWindow
        if (root != null) {
            val shutterKeywords = listOf("shutter", "take picture", "take photo", "capture", "camera", "photo", "snapshot")
            for (kw in shutterKeywords) {
                val node = findNodeByTextOrDesc(root, kw, false)
                if (node != null) {
                    var target: AccessibilityNodeInfo? = node
                    while (target != null && !target.isClickable) {
                        target = target.parent
                    }
                    if (target != null && target.isClickable) {
                        val ok = target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        root.recycle()
                        return ok
                    }
                    val bounds = Rect()
                    node.getBoundsInScreen(bounds)
                    node.recycle()
                    root.recycle()
                    if (bounds.width() > 0 && bounds.height() > 0) {
                        CoroutineScope(Dispatchers.Main).launch {
                            GestureDispatcher.click(this@FridayAccessibilityService, bounds.centerX().toFloat(), bounds.centerY().toFloat())
                        }
                        return true
                    }
                }
            }
            root.recycle()
        }

        // Universal Android camera shutter fallback: tap bottom-center shutter zone
        val displayMetrics = resources.displayMetrics
        val centerX = displayMetrics.widthPixels / 2f
        val centerY = displayMetrics.heightPixels - (displayMetrics.density * 100f)

        CoroutineScope(Dispatchers.Main).launch {
            GestureDispatcher.click(this@FridayAccessibilityService, centerX, centerY)
        }
        return true
    }

    private fun findNodeByTextOrDesc(node: AccessibilityNodeInfo, query: String, matchExact: Boolean): AccessibilityNodeInfo? {
        val text = node.text?.toString()?.lowercase()
        val desc = node.contentDescription?.toString()?.lowercase()
        val id = node.viewIdResourceName?.lowercase() ?: ""

        // If query is looking for search, explicitly exclude voice/mic search nodes
        if (query.contains("search")) {
            if (desc?.contains("voice") == true || desc?.contains("mic") == true || text?.contains("voice") == true || id.contains("voice")) {
                return null
            }
        }

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
            val cx = bounds.centerX().toFloat()
            val cy = bounds.centerY().toFloat()
            card.recycle()
            root.recycle()

            if (actionClicked) return true

            if (bounds.width() > 0 && bounds.height() > 0) {
                CoroutineScope(Dispatchers.Main).launch {
                    GestureDispatcher.click(this@FridayAccessibilityService, cx, cy)
                }
                return true
            }
        }
        root.recycle()
        return false
    }

    private fun findFirstCardContainer(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)

        val desc = (node.contentDescription ?: "").toString().lowercase()
        val text = (node.text ?: "").toString().lowercase()
        val id = (node.viewIdResourceName ?: "").lowercase()

        // Strictly ignore voice / mic / search bar / nav header
        if (desc.contains("voice") || desc.contains("mic") || id.contains("search") || id.contains("voice") || id.contains("header")) {
            return null
        }

        val isCardLike = desc.contains("play") || desc.contains("video") || desc.contains("item") || desc.contains("card") ||
                text.length > 3 || node.isClickable

        if (bounds.top > 150 && bounds.top < 2200 && bounds.height() > 80 && bounds.width() > 200) {
            if (node.isClickable || isCardLike) {
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
        return false
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
        return false
    }

    fun pressEnterOrSearch(): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    val imeOk = focused.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)
                    if (imeOk) {
                        focused.recycle()
                        root.recycle()
                        return true
                    }
                } catch (_: Exception) {}
            }
            focused.recycle()
        }
        root.recycle()
        return false
    }
}
