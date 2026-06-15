import { toolRegistry } from '../toolRegistry';
import { readActiveFileTool } from './read-active-file';
import { editFileTool } from './edit-file';
import { listOpenFilesTool } from './list-open-files';
import { readFileByNameTool } from './read-file-by-name';
import { finishTool } from './finish';
import { batchReadFilesTool } from './batch-read-files';
import { searchCodeTool } from './search-code';
import { askUserTool } from './ask-user';

export function registerBuiltinTools(): void {
  toolRegistry.register(readActiveFileTool);
  toolRegistry.register(editFileTool);
  toolRegistry.register(listOpenFilesTool);
  toolRegistry.register(readFileByNameTool);
  toolRegistry.register(finishTool);
  toolRegistry.register(batchReadFilesTool);
  toolRegistry.register(searchCodeTool);
  toolRegistry.register(askUserTool);
}
