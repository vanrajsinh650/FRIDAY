import { ToolDefinition, ToolResult } from './types';
import { launchAppTool, openUrlTool } from './appTools';
import { inspectScreenTool, clickNodeTool, typeTextTool, scrollPageTool, pressBackTool } from './uiTools';
import { getBatteryStatusTool, setVolumeTool, setBrightnessTool, setFlashlightTool } from './systemTools';

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static initialize(): void {
    const defaultTools = [
      launchAppTool,
      openUrlTool,
      inspectScreenTool,
      clickNodeTool,
      typeTextTool,
      scrollPageTool,
      pressBackTool,
      getBatteryStatusTool,
      setVolumeTool,
      setBrightnessTool,
      setFlashlightTool,
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
