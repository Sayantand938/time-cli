// src/commands/joke.ts
import { Command } from 'commander';
import axios from 'axios';
import boxen from 'boxen';
import chalk from 'chalk';
import { randomSpinner } from 'cli-spinners';
// We don't need the logger here, as we are not logging info, only handling success/error.

const JOKE_API_URL = 'https://official-joke-api.appspot.com/random_joke';

const jokeCmd = new Command('joke')
  .description('Tells a random programming joke from the internet')
  .action(async () => {
    const spinner = randomSpinner();
    let frameIndex = 0;

    const intervalId = setInterval(() => {
      const frame = spinner.frames[frameIndex % spinner.frames.length];
      process.stdout.write(`\r${chalk.yellow(frame)} Fetching a joke for you...`);
      frameIndex++;
    }, spinner.interval);

    try {
      const response = await axios.get(JOKE_API_URL);
      const { setup, punchline } = response.data;

      clearInterval(intervalId);
      process.stdout.write('\r\x1b[K'); // Clear the spinner line

      const formattedJoke = `${chalk.cyan(setup)}\n\n${chalk.green.bold(punchline)}`;
      const boxedJoke = boxen(formattedJoke, {
        title: 'Random Joke',
        titleAlignment: 'center',
        padding: 1,
        margin: 1,
        borderStyle: 'double',
      });
      console.log(boxedJoke);

    } catch (apiError) {
      // --- THE CORRECTED ERROR HANDLING ---

      // 1. Clean up this command's specific UI (the spinner).
      clearInterval(intervalId);
      process.stdout.write('\r\x1b[K'); // Clear the spinner line before exiting.

      // 2. Throw a user-friendly error. Our global `handleError` in `cli.ts` will catch this.
      // It will format it correctly and exit the process. NO manual error logging here.
      throw new Error('Could not fetch a joke. Please check your internet connection.');
    }
  });

export default jokeCmd;