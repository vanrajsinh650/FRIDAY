package com.friday.accessibility

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

object AccessibilityNodeParser {

    fun parseNodeTree(root: AccessibilityNodeInfo?): JSONObject {
        val result = JSONObject()
        val nodesArray = JSONArray()

        if (root != null) {
            result.put("activePackage", root.packageName?.toString() ?: "unknown")
            traverseAndFilter(root, nodesArray)
        }

        result.put("nodes", nodesArray)
        result.put("timestamp", System.currentTimeMillis())
        return result
    }

    private fun traverseAndFilter(node: AccessibilityNodeInfo, nodesArray: JSONArray) {
        val isClickable = node.isClickable
        val isEditable = node.isEditable
        val isScrollable = node.isScrollable
        val text = node.text?.toString()
        val desc = node.contentDescription?.toString()

        // Pruning heuristic: Only retain interactive or content-bearing nodes
        if (isClickable || isEditable || isScrollable || !text.isNullOrBlank() || !desc.isNullOrBlank()) {
            val bounds = Rect()
            node.getBoundsInScreen(bounds)

            val nodeObj = JSONObject().apply {
                put("id", node.viewIdResourceName ?: "node_${nodesArray.length()}")
                put("className", node.className?.toString() ?: "android.view.View")
                if (!text.isNullOrBlank()) put("text", text)
                if (!desc.isNullOrBlank()) put("contentDescription", desc)
                put("isClickable", isClickable)
                put("isEditable", isEditable)
                put("isScrollable", isScrollable)
                put("isVisible", node.isVisibleToUser)

                val boundsObj = JSONObject().apply {
                    put("left", bounds.left)
                    put("top", bounds.top)
                    put("right", bounds.right)
                    put("bottom", bounds.bottom)
                    put("centerX", bounds.centerX())
                    put("centerY", bounds.centerY())
                    put("width", bounds.width())
                    put("height", bounds.height())
                }
                put("bounds", boundsObj)
            }
            nodesArray.put(nodeObj)
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            traverseAndFilter(child, nodesArray)
            child.recycle()
        }
    }
}
