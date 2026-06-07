import type { Tool, ToolDefinition, ToolResult, ToolContext } from './types';

const CACHE_TTL = 30_000; // 30 seconds
const CACHEABLE_TOOL_NAMES = new Set(['read_active_file', 'list_open_files', 'read_file_by_name', 'batch_read_files', 'search_code']);
const MUTATING_TOOLS = new Set(['edit_file']);

interface CacheEntry {
  result: ToolResult;
  timestamp: number;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private cache = new Map<string, CacheEntry>();

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

  invalidateCache(): void {
    this.cache.clear();
  }

  async execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { toolCallId: '', name, success: false, output: '', error: `Unknown tool: ${name}` };
    }

    const validationError = this.validateArgs(tool, args);
    if (validationError) {
      return { toolCallId: '', name, success: false, output: '', error: validationError };
    }

    if (CACHEABLE_TOOL_NAMES.has(name)) {
      const key = this.cacheKey(name, args);
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.result };
      }
      const result = await tool.execute(args, ctx);
      const isEmptyFileList = name === 'list_open_files' && result.output === '[]';
      if (result.success && !isEmptyFileList) {
        this.cache.set(key, { result, timestamp: Date.now() });
      }
      return result;
    }

    if (MUTATING_TOOLS.has(name)) {
      const result = await tool.execute(args, ctx);
      if (result.success) {
        this.invalidateCache();
      }
      return result;
    }

    return tool.execute(args, ctx);
  }

  private cacheKey(name: string, args: Record<string, unknown>): string {
    const sorted = Object.keys(args).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = args[k];
      return acc;
    }, {});
    return `${name}:${JSON.stringify(sorted)}`;
  }

  private validateArgs(tool: Tool, args: Record<string, unknown>): string | null {
    const schema = tool.parameters as {
      type?: string;
      properties?: Record<string, { type: string }>;
      required?: string[];
    };
    if (!schema?.required?.length) return null;

    for (const field of schema.required) {
      if (!(field in args) || args[field] === undefined || args[field] === null) {
        return `Missing required argument: "${field}"`;
      }
      const propType = schema.properties?.[field]?.type;
      if (propType && !this.matchesType(args[field], propType)) {
        return `Argument "${field}" must be of type ${propType}, got ${typeof args[field]}`;
      }
    }
    return null;
  }

  private matchesType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return true;
    }
  }
}

export const toolRegistry = new ToolRegistry();
