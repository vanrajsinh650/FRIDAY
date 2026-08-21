# FRIDAY — Deployment & Release Architecture

---

## 1. Android Client Sideloading

FRIDAY is built as a signed release APK using Gradle and sideloaded directly onto personal Android devices:
- **Build Command:** `cd android && ./gradlew assembleRelease`
- **Installation:** `adb install -r app/build/outputs/apk/release/app-release.apk`
- **Post-Install Setup:** React Native onboarding wizard guides user to enable Accessibility Service and set FRIDAY as the Default Voice Assistant.

---

## 2. Remote VPS Backend Deployment

The optional cloud brain is containerized with Docker and deployed to a personal VPS:

```yaml
# backend/docker-compose.yml
version: '3.8'
services:
  friday-brain:
    build: .
    restart: always
    ports:
      - "8000:8000"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - NVIDIA_API_KEY=${NVIDIA_API_KEY}
      - FRIDAY_AUTH_SECRET=${FRIDAY_AUTH_SECRET}
    volumes:
      - ./data:/app/data
```