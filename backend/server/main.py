"""
FRIDAY — FastAPI Application Entry Point
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv

load_dotenv()

from server.routes.chat import router as chat_router
from server.routes.tts import router as tts_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("friday")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("━" * 50)
    logger.info("  FRIDAY AI Backend — Starting Up")
    logger.info("━" * 50)

    # Validate required keys
    if not os.getenv("GROQ_API_KEY"):
        logger.error("❌ GROQ_API_KEY is not set. Add it to your .env file.")
    else:
        logger.info("✅ Groq API key loaded.")

    if os.getenv("NVIDIA_API_KEY"):
        logger.info("✅ NVIDIA API key loaded — planning mode enabled.")
    else:
        logger.info("ℹ️  NVIDIA_API_KEY not set — planning falls back to Groq.")

    tts_engine = os.getenv("TTS_ENGINE", "groq")
    voice = os.getenv("FRIDAY_VOICE", "Celeste-PlayAI")
    logger.info(f"🔊 TTS engine: {tts_engine} | Voice: {voice}")
    logger.info("━" * 50)
    logger.info("  FRIDAY is ONLINE. Boss can connect.")
    logger.info("━" * 50)

    yield

    logger.info("🔴 FRIDAY shutting down.")


app = FastAPI(
    title="FRIDAY — AI Assistant Backend",
    description="Iron Man's FRIDAY — Voice AI backend with Groq + NVIDIA + KittenTTS",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────────────────────

app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(tts_router, prefix="/api/tts", tags=["Voice (TTS)"])

# Also expose WebSocket at top level for the browser test UI
from server.routes.chat import websocket_chat
app.add_api_websocket_route("/ws/chat", websocket_chat)


# ─── Health & Status ─────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    from server.core.friday_brain import get_brain
    brain = get_brain()
    return {
        "status": "online",
        "service": "FRIDAY AI Backend",
        "version": "2.1.0",
        **brain.status(),
    }


# ─── Browser Test UI ─────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def test_ui():
    """
    Built-in browser test UI — open http://YOUR_PC_IP:8000 on your phone.
    Supports real-time text chat + FRIDAY voice playback.
    """
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FRIDAY — AI Backend</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#080c14;color:#c8d8f0;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;height:100vh}
    header{background:linear-gradient(135deg,#050a14,#0a1a2e);border-bottom:1px solid #0d2a4a;padding:14px 20px;display:flex;align-items:center;gap:12px}
    .pulse{width:10px;height:10px;border-radius:50%;background:#00aaff;box-shadow:0 0 10px #00aaff;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 6px #00aaff}50%{opacity:.6;box-shadow:0 0 18px #00aaff}}
    header h1{font-size:1.1rem;color:#7ec8e3;letter-spacing:3px;text-transform:uppercase}
    header small{font-size:.7rem;color:#2a5a7a;margin-left:auto}
    #messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
    .msg{max-width:82%;padding:12px 16px;border-radius:12px;line-height:1.55;font-size:.92rem;animation:fadeIn .2s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
    .user{background:#0f2040;border:1px solid #1a3a60;align-self:flex-end;color:#90c8f0}
    .friday{background:#0a180a;border:1px solid #1a3a1a;align-self:flex-start;color:#80e880}
    .friday .label{font-size:.68rem;color:#00aaff;margin-bottom:5px;letter-spacing:2px}
    .friday .audio-btn{margin-top:8px;background:#0a2a0a;border:1px solid #1a4a1a;color:#60c860;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:.8rem}
    .friday .audio-btn:hover{background:#1a3a1a}
    .system{background:#141408;border:1px solid #2a2a12;align-self:center;color:#909040;font-size:.78rem;padding:7px 14px;border-radius:20px}
    .typing span{width:7px;height:7px;border-radius:50%;background:#00aaff;display:inline-block;margin:0 2px;animation:blink 1s infinite}
    .typing span:nth-child(2){animation-delay:.2s}
    .typing span:nth-child(3){animation-delay:.4s}
    @keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}
    #controls{border-top:1px solid #0d2a4a;background:#050a14;padding:12px 16px;display:flex;gap:10px;align-items:center}
    #input{flex:1;background:#0a1828;border:1px solid #1a3a5a;border-radius:8px;color:#c8d8f0;padding:11px 15px;font-size:.95rem;outline:none}
    #input:focus{border-color:#00aaff}
    #send{background:#00aaff;color:#000;border:none;border-radius:8px;padding:11px 20px;font-size:.95rem;font-weight:700;cursor:pointer}
    #send:hover{background:#33bbff}
    #send:disabled{background:#0a2a4a;color:#2a5a7a;cursor:default}
    #voice-btn{background:#0a200a;border:1px solid #1a4a1a;color:#60c860;border-radius:8px;padding:11px 14px;cursor:pointer;font-size:1rem}
    #voice-btn.speaking{background:#200a0a;border-color:#4a1a1a;color:#e06060}
    #mode{font-size:.72rem;color:#2a5a7a;text-align:center;padding:4px 0}
  </style>
</head>
<body>
  <header>
    <div class="pulse"></div>
    <h1>FRIDAY</h1>
    <small id="engine-label">Loading...</small>
  </header>
  <div id="messages">
    <div class="msg system">Connecting to FRIDAY backend...</div>
  </div>
  <div id="mode"></div>
  <div id="controls">
    <input id="input" placeholder="Talk to FRIDAY..." autocomplete="off"/>
    <button id="voice-btn" title="Send + hear FRIDAY speak">🔊</button>
    <button id="send">Send</button>
  </div>

  <script>
    const msgs = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const voiceBtn = document.getElementById('voice-btn');
    const modeEl = document.getElementById('mode');
    const engineLabel = document.getElementById('engine-label');

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/chat`);

    let sessionId = null;
    let fridayEl = null;
    let voiceMode = false;  // if true, auto-play FRIDAY's voice after reply

    // Fetch engine status
    fetch('/health').then(r=>r.json()).then(d=>{
      const groq = d.groq?.model || 'Groq';
      const tts = d.tts || 'TTS';
      engineLabel.textContent = `${groq} | ${tts}`;
    }).catch(()=>{ engineLabel.textContent = 'Backend connected'; });

    ws.onopen = () => addSystem('✅ FRIDAY is online. Text or tap 🔊 to hear her speak.');
    ws.onerror = () => addSystem('❌ Connection error.');
    ws.onclose = () => addSystem('🔴 Disconnected.');

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'token') {
        if (!fridayEl) fridayEl = addFriday('');
        // Remove typing indicator on first token
        const typing = fridayEl.querySelector('.typing');
        if (typing) typing.remove();
        fridayEl.querySelector('.content').textContent += data.content;
        scrollDown();
      } else if (data.type === 'done') {
        sessionId = data.session_id;
        const fullText = fridayEl?.querySelector('.content')?.textContent || '';
        if (voiceMode && fullText) speakText(fullText, fridayEl);
        else if (fridayEl) addPlayButton(fridayEl, fullText);
        fridayEl = null;
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
      } else if (data.type === 'error') {
        addSystem('⚠️ ' + data.message);
        sendBtn.disabled = false;
        input.disabled = false;
      }
    };

    function send() {
      const text = input.value.trim();
      if (!text || ws.readyState !== WebSocket.OPEN) return;
      addUser(text);
      input.value = '';
      sendBtn.disabled = true;
      input.disabled = true;
      fridayEl = addFriday('', true);
      ws.send(JSON.stringify({ message: text, session_id: sessionId }));
    }

    sendBtn.onclick = send;
    input.onkeydown = e => { if (e.key === 'Enter') send(); };

    voiceBtn.onclick = () => {
      voiceMode = !voiceMode;
      voiceBtn.classList.toggle('speaking', voiceMode);
      voiceBtn.textContent = voiceMode ? '🔴' : '🔊';
      modeEl.textContent = voiceMode ? '🔊 Voice mode ON — FRIDAY will speak her replies' : '';
    };

    function speakText(text, parentEl) {
      fetch('/api/tts/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ text })
      }).then(r => {
        if (!r.ok) throw new Error('TTS failed');
        return r.blob();
      }).then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        if (parentEl) {
          const btn = parentEl.querySelector('.audio-btn');
          if (btn) { btn.textContent = '▶ Playing...'; audio.onended = () => btn.textContent = '▶ Play again'; }
        }
      }).catch(err => {
        addSystem('⚠️ Voice playback failed: ' + err.message);
        if (parentEl) addPlayButton(parentEl, text);
      });
    }

    function addPlayButton(el, text) {
      if (!text) return;
      const btn = document.createElement('button');
      btn.className = 'audio-btn';
      btn.textContent = '▶ Hear FRIDAY speak';
      btn.onclick = () => speakText(text, el);
      el.appendChild(btn);
    }

    function addUser(text) {
      const el = document.createElement('div');
      el.className = 'msg user';
      el.textContent = text;
      msgs.appendChild(el);
      scrollDown();
    }

    function addFriday(text, typing=false) {
      const el = document.createElement('div');
      el.className = 'msg friday';
      el.innerHTML = `<div class="label">FRIDAY</div><span class="content">${text}</span>`;
      if (typing) el.innerHTML += `<div class="typing"><span></span><span></span><span></span></div>`;
      msgs.appendChild(el);
      scrollDown();
      return el;
    }

    function addSystem(text) {
      const el = document.createElement('div');
      el.className = 'msg system';
      el.textContent = text;
      msgs.appendChild(el);
      scrollDown();
    }

    function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }
  </script>
</body>
</html>"""
    return html
