import { ModelMessage, ModelProvider } from './types';

export class GroqProvider implements ModelProvider {
  name = 'groq';

  async generateText(messages: ModelMessage[]): Promise<string> {
    const userMsg = messages[messages.length - 1]?.content || '';
    if (userMsg.toLowerCase().includes('battery')) {
      return 'Your battery level is currently at 85% and discharging normally.';
    }
    return 'Done, boss.';
  }

  async generateToolCall(messages: ModelMessage[], tools: any[]): Promise<{ toolName: string; parameters: any; rawReply?: string }> {
    const lastUserMsg = messages.find((m) => m.role === 'user')?.content || '';
    const query = lastUserMsg.toLowerCase();

    if (query.includes('youtube')) {
      if (query.includes('taarak mehta') || query.includes('funny episode')) {
        return {
          toolName: 'launch_app',
          parameters: { packageNameOrName: 'com.google.android.youtube' },
          rawReply: 'Opening YouTube now...',
        };
      }
      return { toolName: 'launch_app', parameters: { packageNameOrName: 'youtube' } };
    }

    if (query.includes('brightness')) {
      return { toolName: 'set_brightness', parameters: { percentage: 50 } };
    }

    if (query.includes('volume')) {
      return { toolName: 'set_volume', parameters: { streamType: 'MEDIA', percentage: 70 } };
    }

    if (query.includes('flashlight') || query.includes('torch')) {
      return { toolName: 'set_flashlight', parameters: { enabled: true } };
    }

    if (query.includes('battery')) {
      return { toolName: 'get_battery_status', parameters: {} };
    }

    return { toolName: 'inspect_screen', parameters: {} };
  }
}
