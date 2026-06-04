import type { Tool, ToolDefinition, ToolResult, ToolContext } from './types';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(allowedTools?: string[] | '*'): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const [name, tool] of this.tools) {
      if (!allowedTools || allowedTools === '*' || allowedTools.includes(name)) {
        defs.push({ name, description: tool.description, parameters: tool.parameters });
      }
    }
    return defs;
  }

  async execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { toolCallId: '', name, success: false, output: '', error: `Unknown tool: ${name}` };
    }
    return tool.execute(args, ctx);
  }
}

export const toolRegistry = new ToolRegistry();
