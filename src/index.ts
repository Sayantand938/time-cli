import { program } from 'commander';
import { registerStartCommand } from './commands/start';
import { registerStopCommand } from './commands/stop';
import { registerListCommand } from './commands/list';
import { registerAddCommand } from './commands/add';
import { registerDeleteCommand } from './commands/delete';
import { registerSummaryCommand } from './commands/summary'; // <-- Import summary command
import { db } from './lib/db';
import { version } from '../package.json';

async function main() {
    if (!db) {
        console.error("Database failed to initialize. Exiting.");
        process.exit(1);
    }

    program
        .version(version)
        .name("time-cli")
        .description('Time CLI - A simple command-line time tracker');

    // Register all commands
    registerStartCommand(program);
    registerStopCommand(program);
    registerListCommand(program);
    registerAddCommand(program);
    registerDeleteCommand(program);
    registerSummaryCommand(program); // <-- Register summary command

    // Add default behavior or help if no command is specified
    program.on('command:*', () => {
        console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
        process.exit(1);
    });

    // Parse arguments and execute corresponding command action
    await program.parseAsync(process.argv);

     // If no command was matched by Commander (and arguments were provided), show error.
     // If no arguments were provided at all, show help.
    if (process.argv.slice(2).length > 0 && !program.args.includes(process.argv[2])) {
         if (!program.commands.map(cmd => cmd.name()).includes(process.argv[2]) && !['--help', '-h', '--version', '-V'].includes(process.argv[2])) {
             console.error('Invalid command: %s\nSee --help for a list of available commands.', process.argv[2]);
             process.exit(1);
         }
    } else if (!process.argv.slice(2).length) {
        program.outputHelp();
    }
}

main().catch(error => {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
});