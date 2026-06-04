import { toolRegistry } from '../toolRegistry';
import { readActiveFileTool } from './read-active-file';
import { editFileTool } from './edit-file';
import { listOpenFilesTool } from './list-open-files';
import { readFileByNameTool } from './read-file-by-name';
import { finishTool } from './finish';

export function registerBuiltinTools(): void {
  toolRegistry.register(readActiveFileTool);
  toolRegistry.register(editFileTool);
  toolRegistry.register(listOpenFilesTool);
  toolRegistry.register(readFileByNameTool);
  toolRegistry.register(finishTool);
}
