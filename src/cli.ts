#!/usr/bin/env node
import { program, Command } from 'commander';
import { handleError } from './utils/errorHandler.js';
import fs from 'fs/promises';
import path from 'path';
// 1. Import pathToFileURL from the 'url' module
import { fileURLToPath, pathToFileURL } from 'url';

// Catch unhandled promise rejections
process.on('unhandledRejection', handleError);

async function main() {
  try {
    program
      .name('time-cli')
      .description('A simple CLI tool with dynamic command loading');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const commandsDir = path.join(__dirname, 'commands');
    const commandFiles = await fs.readdir(commandsDir);

    for (const file of commandFiles) {
      // When running from 'dist', the files will be .js
      // This check handles both 'tsx' dev environment (.ts) and compiled (.js)
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        // Prevent loading of .map files in the dist folder
        if(file.endsWith('.map')) continue;

        const commandPath = path.join(commandsDir, file);

        // 2. THE FIX: Convert the file path to a file URL
        const commandURL = pathToFileURL(commandPath);

        // 3. Import the module using the URL's href property
        const { default: command } = await import(commandURL.href);
        
        if (command instanceof Command) {
          program.addCommand(command);
        }
      }
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
}

main();