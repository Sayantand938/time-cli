import { Command } from 'commander';

// Register a simple "hello" command that prints "Hello, World!"
export function registerHelloCommand(program: Command) {
    program
        .command('hello')
        .description('Prints "Hello, World!"')
        .action(() => {
            console.log("Hello, World!");
        });
}