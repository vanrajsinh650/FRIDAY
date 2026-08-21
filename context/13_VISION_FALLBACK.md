# FRIDAY — Vision Fallback Architecture

---

## 1. Trigger Conditions for Vision Fallback

Accessibility node trees are fast and lightweight, but they cannot inspect all UI structures. FRIDAY automatically triggers **Vision Fallback** under the following conditions:
1. **Custom Canvas / Flutter / Game UI:** When `rootInActiveWindow` contains zero interactive child nodes or returns a single opaque surface view.
2. **Unlabeled Icon Ambiguity:** When multiple clickable icon buttons exist without text or content descriptions.
3. **Accessibility Action Failure:** When a node click succeeds programmatically but the screen fails to transition.

---

## 2. Vision Pipeline

```text
Accessibility Parse Fails / Node Empty
      │
      ▼
MediaProjection API Screen Capture (1080x2400)
      │
      ▼ Downscale to 720p & JPEG compress (50KB)
Fast Visual Grounding Model (Groq Llama Vision / Gemini Flash)
      │
      ▼ Normalized Coordinates (x: 0.85, y: 0.12)
Coordinate Scaling to Physical Device Resolution (x: 918px, y: 288px)
      │
      ▼
AccessibilityService.dispatchGesture(Tap at 918, 288)
      │
      ▼
Verify Visual Change
```