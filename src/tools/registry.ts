import { ToolDefinition, ToolResult } from './types';
import { openUrlTool, closeAppTool, closeCurrentAppTool } from './appTools';
import {
  inspectScreenTool,
  clickNodeTool,
  typeTextTool,
  scrollPageTool,
  pressBackTool,
  closeBackgroundAppsTool,
  describeScreenTool,
} from './uiTools';
import {
  launchAppPrimitiveTool,
  getForegroundAppTool,
  clickTextTool,
  clickFirstResultTool,
  clickFullScreenTool,
  clickSendButtonTool,
  pressEnterTool,
  waitForElementTool,
  verifyPlaybackActiveTool,
  verifyMessageSentTool,
} from './phoneControlTools';
import {
  toggleWifiTool,
  getWifiStatusTool,
  toggleBluetoothTool,
  getBluetoothStatusTool,
  toggleHotspotTool,
  getDeviceCapabilitiesTool,
} from './systemCapabilityTools';
import {
  getBatteryStatusTool,
  setVolumeTool,
  setBrightnessTool,
  setRingerModeTool,
  setFlashlightTool,
  readNotificationsTool,
  playMediaTool,
  setAlarmTool,
  sendWhatsAppMessageTool,
  getAlarmsTool,
  callPhoneTool,
  sendSmsTool,
  openCameraTool,
  getCurrentTimeTool,
  dismissAlarmTool,
  showAlarmsTool,
  getInstalledAppsTool,
} from './systemTools';
import {
  saveMemoryFactTool,
  storeMemoryFactTool,
  getMemoryFactsTool,
  forgetMemoryFactTool,
  setRelationshipTool,
  getRelationshipGraphTool,
  manageProfileTool,
} from './memoryTools';
import {
  elevatedTapTool,
  elevatedTextTool,
  elevatedKeyTool,
  killAppSilentTool,
  checkElevatedStatusTool,
  executeElevatedShellTool,
  grantRuntimePermissionTool,
} from './rootControlTools';
import { captureScreenVisionTool, visualTapTool } from './visionTools';
import {
  scheduleAlarmTool,
  scheduleRoutineTool,
  cancelScheduledTaskTool,
  listScheduledTasksTool,
  runProactiveRoutineTool,
} from './schedulerTools';

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static initialize(): void {
    const defaultTools = [
      launchAppPrimitiveTool,
      getForegroundAppTool,
      clickTextTool,
      clickFirstResultTool,
      clickFullScreenTool,
      clickSendButtonTool,
      pressEnterTool,
      waitForElementTool,
      verifyPlaybackActiveTool,
      verifyMessageSentTool,
      toggleWifiTool,
      getWifiStatusTool,
      toggleBluetoothTool,
      getBluetoothStatusTool,
      toggleHotspotTool,
      getDeviceCapabilitiesTool,
      openUrlTool,
      closeAppTool,
      closeCurrentAppTool,
      inspectScreenTool,
      clickNodeTool,
      typeTextTool,
      scrollPageTool,
      pressBackTool,
      closeBackgroundAppsTool,
      describeScreenTool,
      getBatteryStatusTool,
      setVolumeTool,
      setBrightnessTool,
      setRingerModeTool,
      setFlashlightTool,
      readNotificationsTool,
      playMediaTool,
      setAlarmTool,
      sendWhatsAppMessageTool,
      getAlarmsTool,
      callPhoneTool,
      sendSmsTool,
      openCameraTool,
      getCurrentTimeTool,
      dismissAlarmTool,
      showAlarmsTool,
      getInstalledAppsTool,
      saveMemoryFactTool,
      storeMemoryFactTool,
      getMemoryFactsTool,
      forgetMemoryFactTool,
      setRelationshipTool,
      getRelationshipGraphTool,
      manageProfileTool,
      elevatedTapTool,
      elevatedTextTool,
      elevatedKeyTool,
      killAppSilentTool,
      checkElevatedStatusTool,
      executeElevatedShellTool,
      grantRuntimePermissionTool,
      captureScreenVisionTool,
      visualTapTool,
      scheduleAlarmTool,
      scheduleRoutineTool,
      cancelScheduledTaskTool,
      listScheduledTasksTool,
      runProactiveRoutineTool,
    ];
    for (const tool of defaultTools) {
      this.tools.set(tool.name, tool);
    }
  }

  static registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  static getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  static getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  static getToolSchemas(): any[] {
    return Array.from(this.tools.values()).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  static async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found in registry.` };
    }
    try {
      return await tool.execute(params);
    } catch (err: any) {
      return { success: false, error: err.message || `Error executing tool "${name}"` };
    }
  }
}

// Initialize tools
ToolRegistry.initialize();
