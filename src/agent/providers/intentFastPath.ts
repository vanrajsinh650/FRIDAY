import { ToolCallResult } from './types';

// Tier 0 — deterministic, offline intent resolution.
//
// Fast perception/reasoning tier: fixed ladder of English patterns mapping
// an utterance straight onto a tool call or crisp Iron Man F.R.I.D.A.Y. response.
//
export function resolveIntent(lastUserMsg: string): ToolCallResult | null {
  if (!lastUserMsg) return null;
  // Strip any vision prompt injection or trailing multiline annotations
  const cleanedMsg = lastUserMsg.split(/\n\s*\[screen vision\]/i)[0].trim().toLowerCase();
  lastUserMsg = cleanedMsg || lastUserMsg.toLowerCase().trim();
  // 0. App Launch Fast-Path
  if (
    lastUserMsg.startsWith('open ') ||
    lastUserMsg.startsWith('launch ') ||
    lastUserMsg.startsWith('start ') ||
    lastUserMsg.startsWith('please open ')
  ) {
    if (
      !lastUserMsg.includes('play') &&
      !lastUserMsg.includes('search') &&
      !lastUserMsg.includes('send') &&
      !lastUserMsg.includes('message') &&
      !lastUserMsg.includes('video') &&
      !lastUserMsg.includes('song')
    ) {
      let appName = lastUserMsg
        .replace(/^(open|launch|start|please open)\s+/i, '')
        .replace(/\s+app$/i, '')
        .trim();
      if (appName.length > 0) {
        if (appName === 'camera') {
          return { toolName: 'open_camera', parameters: {} };
        }
        if (appName === 'youtube') {
          return { toolName: 'launch_app', parameters: { packageNameOrName: 'com.google.android.youtube' } };
        }
        return { toolName: 'launch_app', parameters: { packageNameOrName: appName } };
      }
    }
  }

  // 0.1 Wi-Fi Fast-Path
  if (lastUserMsg.includes('wifi') || lastUserMsg.includes('wi-fi')) {
    const isOff = lastUserMsg.includes('off') || lastUserMsg.includes('disable') || lastUserMsg.includes('turn off');
    const isOn = lastUserMsg.includes('on') || lastUserMsg.includes('enable') || lastUserMsg.includes('turn on');
    if (isOff) return { toolName: 'toggle_wifi', parameters: { enabled: false } };
    if (isOn) return { toolName: 'toggle_wifi', parameters: { enabled: true } };
    return { toolName: 'get_wifi_status', parameters: {} };
  }

  // 0.2 Bluetooth Fast-Path
  if (lastUserMsg.includes('bluetooth') || lastUserMsg.includes('bt')) {
    const isOff = lastUserMsg.includes('off') || lastUserMsg.includes('disable') || lastUserMsg.includes('turn off');
    const isOn = lastUserMsg.includes('on') || lastUserMsg.includes('enable') || lastUserMsg.includes('turn on');
    if (isOff) return { toolName: 'toggle_bluetooth', parameters: { enabled: false } };
    if (isOn) return { toolName: 'toggle_bluetooth', parameters: { enabled: true } };
    return { toolName: 'get_bluetooth_status', parameters: {} };
  }

  // 0.3 Hotspot Fast-Path
  if (lastUserMsg.includes('hotspot') || lastUserMsg.includes('tethering')) {
    const isOff = lastUserMsg.includes('off') || lastUserMsg.includes('disable');
    return { toolName: 'toggle_hotspot', parameters: { enabled: !isOff } };
  }

  // 1. Natural Language Notification & Message Queries (English)
  if (
    (lastUserMsg.includes('notification') ||
      lastUserMsg.includes('notif') ||
      lastUserMsg.includes('message') ||
      lastUserMsg.includes('messages') ||
      lastUserMsg.includes('msg') ||
      lastUserMsg.includes('alert') ||
      lastUserMsg.includes('alerts') ||
      lastUserMsg.includes('text') ||
      lastUserMsg.includes('sms')) &&
    (lastUserMsg.includes('tell') ||
      lastUserMsg.includes('read') ||
      lastUserMsg.includes('check') ||
      lastUserMsg.includes('any') ||
      lastUserMsg.includes('new') ||
      lastUserMsg.includes('show') ||
      lastUserMsg.includes('what') ||
      lastUserMsg.includes('who') ||
      lastUserMsg.includes('get') ||
      lastUserMsg.includes('list') ||
      lastUserMsg.includes('summary') ||
      lastUserMsg.includes('summarize'))
  ) {
    return { toolName: 'read_notifications', parameters: { filterApp: '', limit: 10 } };
  }

  // 2. Memory / Facts Storing ("remember that X", "save that X")
  if (
    lastUserMsg.startsWith('remember that ') ||
    lastUserMsg.startsWith('remember ') ||
    lastUserMsg.startsWith('save fact ') ||
    lastUserMsg.startsWith('note that ')
  ) {
    const factContent = lastUserMsg
      .replace(/^(remember that|remember|save fact|note that)\s+/i, '')
      .trim();
    if (factContent.length > 3) {
      let key = 'user_fact';
      let val = factContent;
      if (factContent.includes(' is ')) {
        const parts = factContent.split(' is ');
        key = parts[0].trim();
        val = parts.slice(1).join(' is ').trim();
      }
      return { toolName: 'store_memory_fact', parameters: { key, value: val, category: 'profile' } };
    }
  }

  // 3. Memory / Facts Retrieval ("what do you remember about me", "do you remember")
  if (
    lastUserMsg.includes('what do you remember') ||
    lastUserMsg.includes('what do you know about me') ||
    lastUserMsg.includes('my profile') ||
    lastUserMsg.includes('what are my saved facts')
  ) {
    return { toolName: 'get_memory_facts', parameters: { query: 'profile' } };
  }

  // 4. Forget Facts ("forget my X", "delete memory")
  if (lastUserMsg.startsWith('forget ') || lastUserMsg.startsWith('delete memory ') || lastUserMsg.startsWith('remove fact ')) {
    const key = lastUserMsg
      .replace(/^(forget|delete memory|remove fact)\s+/i, '')
      .replace(/^my\s+/i, '')
      .trim();
    if (key.length > 0) {
      return { toolName: 'forget_memory_fact', parameters: { key } };
    }
  }

  // 5. Close Background Apps ("close all apps", "clear background apps")
  if (
    lastUserMsg.includes('close all apps') ||
    lastUserMsg.includes('close all background apps') ||
    lastUserMsg.includes('clear all apps') ||
    lastUserMsg.includes('clear background apps') ||
    lastUserMsg.includes('kill all apps')
  ) {
    return { toolName: 'close_background_apps', parameters: {} };
  }

  // 6. Close Current App ("close this app", "close app", "close current app")
  if (
    lastUserMsg === 'close app' ||
    lastUserMsg === 'close this app' ||
    lastUserMsg === 'close current app' ||
    lastUserMsg === 'exit app' ||
    lastUserMsg === 'close'
  ) {
    return { toolName: 'close_current_app', parameters: {} };
  }

  // 6.1 Force Stop / Kill App (Elevated Fast-Path)
  if (
    lastUserMsg.startsWith('force stop ') ||
    lastUserMsg.startsWith('force-stop ') ||
    lastUserMsg.startsWith('force close ') ||
    lastUserMsg.startsWith('kill app ') ||
    lastUserMsg.startsWith('silent kill ')
  ) {
    const firstLine = lastUserMsg.split('\n')[0].trim();
    const pkg = firstLine
      .replace(/^(force stop|force-stop|force close|kill app|silent kill)\s+/i, '')
      .replace(/\s+app$/i, '')
      .trim();
    if (pkg.length > 0) {
      return { toolName: 'kill_app_silent', parameters: { packageName: pkg } };
    }
  }

  // 6.2 Check Elevated / Root / Shizuku Status
  if (
    lastUserMsg.includes('root status') ||
    lastUserMsg.includes('shizuku status') ||
    lastUserMsg.includes('check elevated') ||
    lastUserMsg.includes('check root') ||
    lastUserMsg.includes('is phone rooted') ||
    lastUserMsg.includes('is device rooted')
  ) {
    return { toolName: 'check_elevated_status', parameters: {} };
  }

  // 7. Alarms & Timers
  if (
    lastUserMsg.includes('alarm') ||
    lastUserMsg.includes('wake me up') ||
    lastUserMsg.includes('set an alarm') ||
    lastUserMsg.includes('set alarm')
  ) {
    if (
      lastUserMsg.includes('cancel') ||
      lastUserMsg.includes('stop') ||
      lastUserMsg.includes('turn off') ||
      lastUserMsg.includes('dismiss') ||
      lastUserMsg.includes('disable')
    ) {
      return { toolName: 'dismiss_alarm', parameters: {} };
    }

    if (
      lastUserMsg.includes('show') ||
      lastUserMsg.includes('list') ||
      lastUserMsg.includes('open') ||
      lastUserMsg.includes('check') ||
      lastUserMsg.includes('what alarms')
    ) {
      return { toolName: 'show_alarms', parameters: {} };
    }

    const timeMatch = lastUserMsg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      let minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = (timeMatch[3] || '').toLowerCase();

      if (meridiem === 'pm' && hour < 12) hour += 12;
      else if (meridiem === 'am' && hour === 12) hour = 0;
      else if (!meridiem) {
        if ((lastUserMsg.includes('evening') || lastUserMsg.includes('night')) && hour < 12) hour += 12;
      }

      const label = lastUserMsg.includes('for ')
        ? lastUserMsg.split('for ')[1].trim()
        : 'FRIDAY Alarm';

      return {
        toolName: 'set_alarm',
        parameters: { hour, minute, message: label, skipUi: true },
      };
    }
  }

  // 8. Flashlight / Torch
  if (lastUserMsg.includes('flashlight') || lastUserMsg.includes('torch')) {
    const isOff = lastUserMsg.includes('off') || lastUserMsg.includes('disable') || lastUserMsg.includes('turn off');
    return { toolName: 'set_flashlight', parameters: { enabled: !isOff } };
  }

  // 9. Battery Status
  if (
    lastUserMsg.includes('battery') ||
    lastUserMsg.includes('charge') ||
    lastUserMsg.includes('power level')
  ) {
    return { toolName: 'get_battery_status', parameters: {} };
  }

  // 10. Brightness
  if (lastUserMsg.includes('brightness')) {
    const match = lastUserMsg.match(/\d+/);
    let level = 50;
    if (match) {
      level = parseInt(match[0], 10);
    } else if (lastUserMsg.includes('full') || lastUserMsg.includes('max') || lastUserMsg.includes('100')) {
      level = 100;
    } else if (lastUserMsg.includes('low') || lastUserMsg.includes('dim') || lastUserMsg.includes('min')) {
      level = 15;
    } else if (lastUserMsg.includes('half') || lastUserMsg.includes('50')) {
      level = 50;
    }
    return { toolName: 'set_brightness', parameters: { percentage: level } };
  }

  // 11. Volume & Ringer
  if (lastUserMsg.includes('silent mode') || lastUserMsg.includes('put phone on silent')) {
    return { toolName: 'set_ringer_mode', parameters: { mode: 'SILENT' } };
  }

  if (lastUserMsg.includes('vibrate mode') || lastUserMsg.includes('put phone on vibrate')) {
    return { toolName: 'set_ringer_mode', parameters: { mode: 'VIBRATE' } };
  }

  if (lastUserMsg.includes('ring mode') || lastUserMsg.includes('normal mode')) {
    return { toolName: 'set_ringer_mode', parameters: { mode: 'NORMAL' } };
  }

  if (lastUserMsg.includes('volume') || lastUserMsg.includes('sound') || lastUserMsg.includes('mute')) {
    const match = lastUserMsg.match(/\d+/);
    let level = 80;
    if (match) {
      level = parseInt(match[0], 10);
    } else if (lastUserMsg.includes('mute') || lastUserMsg.includes('silent') || lastUserMsg.includes('zero')) {
      level = 0;
    } else if (lastUserMsg.includes('full') || lastUserMsg.includes('max') || lastUserMsg.includes('100')) {
      level = 100;
    } else if (lastUserMsg.includes('low') || lastUserMsg.includes('quiet')) {
      level = 20;
    } else if (lastUserMsg.includes('half') || lastUserMsg.includes('50')) {
      level = 50;
    }
    return { toolName: 'set_volume', parameters: { streamType: 'MEDIA', percentage: level } };
  }

  // 12. Current Time & Date Queries
  if (
    lastUserMsg.includes('what is the time') ||
    lastUserMsg.includes('current time') ||
    lastUserMsg.includes('tell me the time') ||
    lastUserMsg.includes("what's the time") ||
    lastUserMsg === 'time' ||
    lastUserMsg.includes('what day') ||
    lastUserMsg.includes('what is today') ||
    lastUserMsg.includes("today's date") ||
    lastUserMsg.includes('what is the date')
  ) {
    return { toolName: 'get_current_time', parameters: {} };
  }

  // 13. Conversational Persona & Gender Queries
  if (
    lastUserMsg.includes('gender') ||
    lastUserMsg.includes('boy or girl') ||
    lastUserMsg.includes('girl or boy') ||
    lastUserMsg.includes('are you a girl') ||
    lastUserMsg.includes('female or male')
  ) {
    const reply = "I'm F.R.I.D.A.Y., Boss. Your tactical female AI companion.";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 13.1 Wake & Attention Queries ("wake up", "wake up friday", "hey friday", "friday")
  if (
    lastUserMsg === 'wake up' ||
    lastUserMsg === 'wake up friday' ||
    lastUserMsg === 'wake up jarvis' ||
    lastUserMsg === 'wake up assistant' ||
    lastUserMsg.startsWith('wake up') ||
    lastUserMsg === 'are you awake' ||
    lastUserMsg === 'are you there' ||
    lastUserMsg === 'are you listening' ||
    lastUserMsg === 'friday' ||
    lastUserMsg === 'hey friday' ||
    lastUserMsg === 'hi friday' ||
    lastUserMsg === 'hello friday' ||
    lastUserMsg === 'ok friday' ||
    lastUserMsg === 'okay friday' ||
    lastUserMsg.includes('uth jao')
  ) {
    const reply = "All systems active and ready, Boss. What's the play?";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 13.2 General Greetings ("hello", "hi", "good morning", "good evening", "good night")
  if (
    lastUserMsg === 'hello' ||
    lastUserMsg === 'hi' ||
    lastUserMsg === 'hey' ||
    lastUserMsg.startsWith('hello ') ||
    lastUserMsg.startsWith('hi ') ||
    lastUserMsg.startsWith('hey ')
  ) {
    const reply = "Hello, Boss. Systems nominal. How can I assist you today?";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  if (lastUserMsg.includes('good morning')) {
    const reply = "Good morning, Boss. All diagnostics green. Ready for your commands.";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  if (lastUserMsg.includes('good night')) {
    const reply = "Good night, Boss. Standing by on low power mode.";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  if (lastUserMsg.includes('good evening') || lastUserMsg.includes('good afternoon')) {
    const reply = "Good day, Boss. How can I assist you right now?";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 13.3 Status & Well-being ("how are you", "how r u", "how are things")
  if (
    lastUserMsg.includes('how are you') ||
    lastUserMsg.includes('how r u') ||
    lastUserMsg.includes('how are things') ||
    lastUserMsg.includes('how is it going')
  ) {
    const reply = "All systems running at peak efficiency, Boss. What can I do for you?";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 13.4 Identity & Questions ("who are you", "what is your name")
  if (
    lastUserMsg.includes('who are you') ||
    lastUserMsg.includes('what is your name') ||
    lastUserMsg.includes("what's your name") ||
    lastUserMsg.includes('tell me about yourself')
  ) {
    const reply = "I am FRIDAY (F.R.I.D.A.Y.), Boss — your tactical, ultra-intelligent AI assistant. Systems ready for device automation, media, messaging, and intelligence.";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 13.5 Capabilities & Help ("what can you do", "help", "commands")
  if (
    lastUserMsg.includes('what can you do') ||
    lastUserMsg.includes('help me') ||
    lastUserMsg.includes('what are your features') ||
    lastUserMsg.includes('features') ||
    lastUserMsg === 'help' ||
    lastUserMsg === 'commands'
  ) {
    const reply = "I can manage your device, play media on YouTube, send messages on WhatsApp, configure system toggles, and handle tactical intelligence, Boss.";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 13.6 Gratitude & Appreciation ("thank you", "thanks")
  if (
    lastUserMsg === 'thank you' ||
    lastUserMsg === 'thanks' ||
    lastUserMsg === 'thank u' ||
    lastUserMsg.startsWith('thank you ') ||
    lastUserMsg.startsWith('thanks ')
  ) {
    const reply = "Always a pleasure, Boss.";
    return {
      toolName: 'none',
      parameters: { reply },
      rawReply: reply,
    };
  }

  // 14. Scroll / Swipe / Navigate
  if (
    lastUserMsg.includes('scroll') ||
    lastUserMsg.includes('swipe')
  ) {
    let direction = 'DOWN';
    if (lastUserMsg.includes('up')) direction = 'UP';
    if (lastUserMsg.includes('left')) direction = 'LEFT';
    if (lastUserMsg.includes('right')) direction = 'RIGHT';
    return { toolName: 'scroll_page', parameters: { direction } };
  }

  // 15. Go Back
  if (
    lastUserMsg === 'back' ||
    lastUserMsg === 'go back' ||
    lastUserMsg.startsWith('press back')
  ) {
    return { toolName: 'press_back', parameters: {} };
  }

  // 16. Click on specific text
  if (
    (lastUserMsg.startsWith('click on ') || lastUserMsg.startsWith('tap on ') || lastUserMsg.startsWith('press ') || lastUserMsg.startsWith('click ') || lastUserMsg.startsWith('tap ')) &&
    !lastUserMsg.includes('back') &&
    !lastUserMsg.includes('enter') &&
    !lastUserMsg.includes('send')
  ) {
    const clickTarget = lastUserMsg
      .replace(/^(click on|tap on|press|click|tap)\s+/i, '')
      .replace(/\s+(button|btn|icon|text|link)$/i, '')
      .trim();
    if (clickTarget.length > 0) {
      return { toolName: 'click_text', parameters: { text: clickTarget, exactMatch: false } };
    }
  }

  // 17. Type text into active field
  if (
    lastUserMsg.startsWith('type ') ||
    lastUserMsg.startsWith('write ')
  ) {
    const textToType = lastUserMsg
      .replace(/^(type|write)\s+/i, '')
      .replace(/\s+in\s+(search|box|field|bar)$/i, '')
      .trim();
    if (textToType.length > 0) {
      return { toolName: 'type_text', parameters: { text: textToType, clearFirst: true } };
    }
  }

  // 18. Screen inspection
  if (
    lastUserMsg.includes('screen') ||
    lastUserMsg.includes('what do you see') ||
    lastUserMsg.includes('describe') ||
    lastUserMsg.includes('look at screen')
  ) {
    if (!lastUserMsg.includes('bright') && !lastUserMsg.includes('shot')) {
      return { toolName: 'see_screen', parameters: {} };
    }
  }

  // 19. Phone call
  if (
    lastUserMsg.includes('call ') ||
    lastUserMsg.includes('phone ') ||
    lastUserMsg.includes('dial ') ||
    lastUserMsg.includes('ring ')
  ) {
    const target = lastUserMsg
      .replace(/^(call|phone|dial|ring)\s+/i, '')
      .trim();
    if (target.length > 0) {
      return { toolName: 'make_phone_call', parameters: { phoneNumber: target } };
    }
  }

  // 20. Send SMS
  if (
    (lastUserMsg.includes('sms') || lastUserMsg.includes('text message')) &&
    lastUserMsg.includes('send')
  ) {
    return { toolName: 'send_sms', parameters: { phoneNumber: '', message: lastUserMsg } };
  }

  // 21. Installed apps query
  if (
    lastUserMsg.includes('installed apps') ||
    lastUserMsg.includes('how many apps') ||
    lastUserMsg.includes('list apps')
  ) {
    return { toolName: 'get_installed_apps', parameters: {} };
  }

  // 22. Home screen
  if (
    lastUserMsg === 'home' ||
    lastUserMsg === 'go home' ||
    lastUserMsg === 'home screen'
  ) {
    return { toolName: 'press_back', parameters: {} };
  }

  return null;
}
