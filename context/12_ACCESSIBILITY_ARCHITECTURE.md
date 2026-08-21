# FRIDAY — Accessibility Architecture & UI Automation

---

## 1. FridayAccessibilityService Implementation

The core UI automation engine is `FridayAccessibilityService` (`android/app/src/main/java/com/friday/accessibility/FridayAccessibilityService.kt`), registered with `android.permission.BIND_ACCESSIBILITY_SERVICE`.

### Capabilities:
1. **Interactive Node Traversal:** Recursively reads `rootInActiveWindow` to parse all visible, clickable, and editable views.
2. **Node Tree Pruning (Token Minimization):** Strips empty containers, layout wrappers, and invisible off-screen views, reducing raw Android UI trees (500+ nodes) to compact semantic trees (~15-30 interactive elements).
3. **Gesture Dispatch:** Calls `dispatchGesture()` with programmatic `GestureDescription` strokes to perform pixel-perfect taps, swipes, and scroll gestures.
4. **Text Injection:** Injects text directly into focused editable nodes using `AccessibilityNodeInfo.ACTION_SET_TEXT`.

---

## 2. Compact Semantic UI Representation

```json
{
  "activePackage": "com.google.android.youtube",
  "screen": "Search_Results",
  "interactiveElements": [
    { "id": "node_4", "type": "button", "label": "Search", "bounds": [950, 80, 1050, 160] },
    { "id": "node_12", "type": "video_card", "title": "Taarak Mehta Episode 124 Funny Moments", "views": "14M views", "bounds": [40, 280, 1040, 720] }
  ]
}
```