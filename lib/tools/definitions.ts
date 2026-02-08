import { z } from 'zod';

export const MoveItemSchema = z.object({
    source: z.string().describe('Relative path of the file/folder to move'),
    destination: z.string().describe('New relative path'),
});

export const CreateFolderSchema = z.object({
    path: z.string().describe('Relative path of the directory to create'),
});

export const WriteFileSchema = z.object({
    path: z.string().describe('Relative path of the file'),
    content: z.string().describe('Content to write'),
});

export const ReadFileSchema = z.object({
    path: z.string().describe('Relative path of the file to read'),
});

export const SearchWebSchema = z.object({
    query: z.string().describe('Search query'),
    domain_filter: z.array(z.string()).optional().describe('Restrict to these domains'),
});

export const RunCommandSchema = z.object({
    command: z.string().describe('Shell command to execute in the sandbox'),
});

export type MoveItemArgs = z.infer<typeof MoveItemSchema>;
export type CreateFolderArgs = z.infer<typeof CreateFolderSchema>;
export type WriteFileArgs = z.infer<typeof WriteFileSchema>;
export type ReadFileArgs = z.infer<typeof ReadFileSchema>;
export type SearchWebArgs = z.infer<typeof SearchWebSchema>;
export type RunCommandArgs = z.infer<typeof RunCommandSchema>;

export const tools = {
    move_item: { name: 'move_item', description: 'Move or rename a file/directory.', inputSchema: MoveItemSchema },
    create_folder: { name: 'create_folder', description: 'Create a directory.', inputSchema: CreateFolderSchema },
    write_file: { name: 'write_file', description: 'Write content to a file.', inputSchema: WriteFileSchema },
    read_file: { name: 'read_file', description: 'Read file content.', inputSchema: ReadFileSchema },
    search_web: { name: 'search_web', description: 'Search the web.', inputSchema: SearchWebSchema },
    run_command: { name: 'run_command', description: 'Execute a shell command.', inputSchema: RunCommandSchema },
};
