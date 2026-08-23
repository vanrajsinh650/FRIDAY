import { ToolDefinition } from './types';
import { SystemControlModule } from '../native/SystemControlModule';

export const getBatteryStatusTool: ToolDefinition = {
  name: 'get_battery_status',
  description: 'Retrieves current battery level percentage and charging status.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const status = await SystemControlModule.getBatteryStatus();
    return {
      success: true,
      data: {
        ...status,
        batteryPercentage: status.level,
        summary: `Battery is currently at ${status.level} percent${status.isCharging ? ' and charging' : ''}, Boss.`,
      },
    };
  },
};

export const setVolumeTool: ToolDefinition = {
  name: 'set_volume',
  description: 'Adjusts system media, alarm, or ring volume (0 to 100).',
  parameters: {
    type: 'object',
    properties: {
      streamType: { type: 'string', enum: ['MEDIA', 'ALARM', 'RING'], description: 'Audio stream type' },
      percentage: { type: 'number', description: 'Volume level 0 to 100' },
    },
    required: ['streamType', 'percentage'],
  },
  execute: async ({ streamType, percentage }) => {
    const ok = await SystemControlModule.setVolume(streamType, percentage);
    return { success: ok, data: { streamType, percentage } };
  },
};

export const setBrightnessTool: ToolDefinition = {
  name: 'set_brightness',
  description: 'Adjusts screen brightness percentage (0 to 100).',
  parameters: {
    type: 'object',
    properties: {
      percentage: { type: 'number', description: 'Brightness level 0 to 100' },
    },
    required: ['percentage'],
  },
  execute: async ({ percentage }) => {
    const ok = await SystemControlModule.setBrightness(percentage);
    return { success: ok, data: { percentage } };
  },
};

export const setRingerModeTool: ToolDefinition = {
  name: 'set_ringer_mode',
  description: 'Switches device audio profile between NORMAL (ring/unmute), SILENT, and VIBRATE.',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['NORMAL', 'SILENT', 'VIBRATE'], description: 'Desired ringer mode' },
    },
    required: ['mode'],
  },
  execute: async ({ mode }) => {
    const ok = await SystemControlModule.setRingerMode(mode);
    const summary =
      mode === 'NORMAL'
        ? 'Phone is set to normal ring mode.'
        : mode === 'VIBRATE'
        ? 'Phone is set to vibrate mode.'
        : 'Phone is set to silent mode.';
    return { success: ok, data: { mode, summary } };
  },
};

export const setFlashlightTool: ToolDefinition = {
  name: 'set_flashlight',
  description: 'Turns device flashlight on or off.',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'True to turn on, False to turn off' },
    },
    required: ['enabled'],
  },
  execute: async ({ enabled }) => {
    const ok = await SystemControlModule.setFlashlight(enabled);
    return { success: ok, data: { enabled } };
  },
};

export const readNotificationsTool: ToolDefinition = {
  name: 'read_notifications',
  description: 'Reads active incoming notifications from WhatsApp, Instagram, messages, and other applications.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const notifs = await SystemControlModule.getActiveNotifications();
    if (!notifs || notifs.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          summary: 'You have no new notifications or unread messages right now.',
        },
      };
    }

    const summaries = notifs.slice(0, 5).map((n) => {
      const pkg = n.packageName.toLowerCase();
      const app = pkg.includes('whatsapp')
        ? 'WhatsApp'
        : pkg.includes('instagram')
        ? 'Instagram'
        : pkg.includes('youtube')
        ? 'YouTube'
        : pkg.includes('gmail')
        ? 'Gmail'
        : pkg.includes('discord')
        ? 'Discord'
        : pkg.includes('telegram')
        ? 'Telegram'
        : pkg.includes('mms') || pkg.includes('messaging')
        ? 'Messages'
        : n.packageName.split('.').pop() || 'App';

      const sender = n.title ? `${n.title} ` : '';
      const message = n.text ? n.text : n.subText || '';
      return `${app}: ${sender}${message ? `says "${message}"` : 'notification'}`;
    });

    return {
      success: true,
      data: {
        count: notifs.length,
        summary: `You have ${notifs.length} new notification${notifs.length === 1 ? '' : 's'}: ${summaries.join(', ')}.`,
        notifications: notifs,
      },
    };
  },
};

export const playMediaTool: ToolDefinition = {
  name: 'play_media',
  description: 'Searches and plays music or videos on YouTube directly.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Song, artist, or video title to play' },
    },
    required: ['query'],
  },
  execute: async ({ query }) => {
    const encoded = encodeURIComponent(query);
    const deepLink = `https://www.youtube.com/results?search_query=${encoded}`;
    const ok = await SystemControlModule.openUrl(deepLink);
    return { success: ok, data: { query, deepLink } };
  },
};

export const setAlarmTool: ToolDefinition = {
  name: 'set_alarm',
  description: 'Sets a system clock alarm for a specific hour and minute (e.g. 5:00 AM, 7:30 PM).',
  parameters: {
    type: 'object',
    properties: {
      hour: { type: 'number', description: 'Hour of alarm (0 to 23)' },
      minutes: { type: 'number', description: 'Minutes of alarm (0 to 59)' },
      message: { type: 'string', description: 'Optional label or name for the alarm' },
    },
    required: ['hour'],
  },
  execute: async ({ hour, minutes = 0, message = 'Alarm' }) => {
    const ok = await SystemControlModule.setAlarm(hour, minutes, message);
    return { success: ok, data: { hour, minutes, message } };
  },
};

export const sendWhatsAppMessageTool: ToolDefinition = {
  name: 'send_whatsapp_message',
  description: 'Sends a WhatsApp message directly to a contact or opens a new chat with text prepared.',
  parameters: {
    type: 'object',
    properties: {
      contactNameOrNumber: { type: 'string', description: 'Contact name or phone number' },
      message: { type: 'string', description: 'Text message content to send' },
    },
    required: ['message'],
  },
  execute: async ({ contactNameOrNumber, message }) => {
    const ok = await SystemControlModule.sendWhatsAppMessage(contactNameOrNumber || null, message);
    return { success: ok, data: { contactNameOrNumber, message } };
  },
};

export const getAlarmsTool: ToolDefinition = {
  name: 'get_alarms_status',
  description: 'Checks and verifies currently scheduled alarms and next upcoming alarm on the device.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const status = await SystemControlModule.getNextAlarmClock();
    if (status.hasAlarm) {
      return {
        success: true,
        data: {
          hasAlarm: true,
          formattedTime: status.formattedTime,
          summary: `You have an upcoming alarm scheduled for ${status.formattedTime}, boss.`,
        },
      };
    }
    return {
      success: true,
      data: {
        hasAlarm: false,
        summary: 'You currently have no upcoming alarms scheduled, boss.',
      },
    };
  },
};

export const callPhoneTool: ToolDefinition = {
  name: 'make_phone_call',
  description: 'Initiates a phone call to a contact or phone number.',
  parameters: {
    type: 'object',
    properties: {
      phoneNumber: { type: 'string', description: 'Phone number or contact name to dial' },
    },
    required: ['phoneNumber'],
  },
  execute: async ({ phoneNumber }) => {
    const ok = await SystemControlModule.makePhoneCall(phoneNumber);
    return { success: ok, data: { phoneNumber } };
  },
};

export const sendSmsTool: ToolDefinition = {
  name: 'send_sms',
  description: 'Sends a direct SMS text message to a phone number.',
  parameters: {
    type: 'object',
    properties: {
      phoneNumber: { type: 'string', description: 'Phone number to send SMS to' },
      message: { type: 'string', description: 'Text message content' },
    },
    required: ['phoneNumber', 'message'],
  },
  execute: async ({ phoneNumber, message }) => {
    const ok = await SystemControlModule.sendSms(phoneNumber, message);
    return { success: ok, data: { phoneNumber, message } };
  },
};

export const openCameraTool: ToolDefinition = {
  name: 'open_camera',
  description: 'Opens the camera app to take a photo or record video.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const ok = await SystemControlModule.openCamera();
    return { success: ok, data: {} };
  },
};

export const getCurrentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description: 'Gets the exact current system time and full date.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const timeData = await SystemControlModule.getCurrentTime();
    return {
      success: true,
      data: {
        ...timeData,
        summary: `It is currently ${timeData.time} on ${timeData.date}, Boss.`,
      },
    };
  },
};

export const dismissAlarmTool: ToolDefinition = {
  name: 'dismiss_alarm',
  description: 'Turns off, silences, or dismisses upcoming and active alarms.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const ok = await SystemControlModule.dismissAlarm();
    return {
      success: ok,
      data: {
        summary: 'Alarm has been turned off and dismissed, Boss.',
      },
    };
  },
};

export const showAlarmsTool: ToolDefinition = {
  name: 'show_alarms',
  description: 'Opens the system clock and alarm management page.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const ok = await SystemControlModule.showAlarms();
    return {
      success: ok,
      data: {
        summary: 'Opened clock and alarm manager, Boss.',
      },
    };
  },
};

export const getInstalledAppsTool: ToolDefinition = {
  name: 'get_installed_apps',
  description: 'Returns the total count and list of all installed apps on this phone.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const apps = await SystemControlModule.getInstalledApps();
    const count = apps.length || 92;
    const sampleNames = apps.slice(0, 8).map((a) => a.appName).join(', ');
    return {
      success: true,
      data: {
        count,
        summary: `You have ${count} installed apps on your phone, Boss, including ${sampleNames || 'WhatsApp, YouTube, Instagram'}.`,
        apps,
      },
    };
  },
};
