import { GoalType } from '../task/types';
import { ToolRegistry } from '../../tools/registry';

export class ToolVisibility {
  static getScopedTools(goalType: GoalType, activePackage: string): any[] {
    const allSchemas = ToolRegistry.getToolSchemas();
    const pkg = activePackage.toLowerCase();

    if (goalType === 'MEDIA_PLAYBACK' || pkg.includes('youtube') || pkg.includes('spotify')) {
      const allowed = [
        'launch_app',
        'type_text',
        'click_text',
        'click_first_result',
        'press_enter',
        'verify_playback_active',
        'inspect_screen',
        'scroll_page',
        'press_back',
        'capture_screen_vision',
        'visual_tap',
      ];
      return allSchemas.filter((s) => allowed.includes(s.function.name));
    }

    if (goalType === 'MESSAGING' || pkg.includes('whatsapp') || pkg.includes('telegram') || pkg.includes('messages')) {
      const allowed = [
        'launch_app',
        'type_text',
        'click_text',
        'click_send_button',
        'verify_message_sent',
        'inspect_screen',
        'scroll_page',
        'press_back',
        'capture_screen_vision',
        'visual_tap',
      ];
      return allSchemas.filter((s) => allowed.includes(s.function.name));
    }

    if (goalType === 'SYSTEM_CONTROL') {
      const allowed = [
        'set_flashlight',
        'set_volume',
        'set_brightness',
        'set_ringer_mode',
        'get_battery_status',
        'set_alarm',
        'dismiss_alarm',
        'get_current_time',
        'read_notifications',
        'close_background_apps',
        'close_app',
        'close_current_app',
        'kill_app_silent',
        'check_elevated_status',
        'elevated_tap',
        'elevated_text',
        'elevated_key',
        'schedule_alarm',
        'schedule_routine',
        'cancel_scheduled_task',
        'list_scheduled_tasks',
        'run_proactive_routine',
        'store_memory_fact',
        'save_memory_fact',
        'get_memory_facts',
        'forget_memory_fact',
        'set_relationship',
        'manage_profile',
        'capture_screen_vision',
        'visual_tap',
      ];
      return allSchemas.filter((s) => allowed.includes(s.function.name));
    }

    // Default: Return full schema set
    return allSchemas;
  }
}
