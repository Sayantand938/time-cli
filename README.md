# time-cli

A simple, robust command-line tool built with Node.js and TypeScript to track study sessions or other timed activities directly from your terminal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- Add other badges if you publish or set up CI/CD -->

## Features

- Start and stop sessions easily.
- Add completed sessions using time ranges or durations.
- List sessions with flexible date filtering (today, yesterday, specific date, all time).
- Edit existing session start/end times using absolute times or relative adjustments.
- Delete sessions by their unique short ID.
- Check the status of the currently running session.
- Calculate Estimated Time of Arrival (ETA) to reach the daily goal (fixed at 8 hours).
- Generate daily summaries with goal status (filterable by month/year).
- Get insightful reports on study habits (totals, averages, daily performance, weekly patterns).
- Export session data to JSON (with date filtering).
- Import sessions from JSON (with overlap detection).
- Stores data locally using SQLite.

## Prerequisites

- [Node.js](https://nodejs.org/) (Version 16 or higher, as specified in `package.json`)
- [npm](https://www.npmjs.com/) (usually included with Node.js)

## Installation

1.  **Clone the repository (if you haven't already):**

    ```bash
    git clone <your-repository-url>
    cd time-cli
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the TypeScript code:**

    ```bash
    npm run build
    ```

4.  **Make the CLI globally available (Method 1: npm link):**
    This is useful for development, creating a symbolic link from your global node modules directory to your project directory.

    ```bash
    npm link
    ```

    You can now run `time-cli` from anywhere in your terminal.

    _(Alternatively, Method 2: Run directly)_ You can run the tool directly from the project directory without linking:

    ```bash
    node dist/index.js <command> [options]
    ```

    Or using `npm start`:

    ```bash
    npm start -- <command> [options]
    ```

    (Note the `--` which separates npm arguments from your script's arguments).

## Basic Usage

- **Get Help:** `time-cli --help` (Shows all available commands)
- **Get Version:** `time-cli --version`

## Commands

Here's a detailed reference for all available commands:

---

### `time-cli start`

Starts a new tracking session.

- **Description:** Records the current time as the start time for a new session and marks it as active. Errors if a session is already running.
- **Options:** None
- **Example:**
  ```bash
  time-cli start
  # Output: Session started at 09:15 AM.
  ```

---

### `time-cli stop`

Stops the currently active tracking session.

- **Description:** Records the current time as the end time for the active session, calculates the duration, and marks the session as complete. Errors if no session is running.
- **Options:** None
- **Example:**
  ```bash
  time-cli stop
  # Output: Session stopped at 10:30 AM.
  #         Duration: 01:15
  ```

---

### `time-cli status`

Shows the status of the current session.

- **Description:** Displays whether a session is currently active. If active, shows the start time and elapsed duration.
- **Options:** None
- **Example (Session Active):**
  ```bash
  time-cli status
  # Output:
  # --- Session Active ---
  #    Started:  09:15 AM
  #    Elapsed:  00:45
  ```
- **Example (No Session Active):**
  ```bash
  time-cli status
  # Output:
  #  No active session
  #
  #    Use time-cli start to begin a new session.
  ```

---

### `time-cli add`

Adds a completed session manually. You must specify _either_ a time range or a duration ending now.

- **Description:** Logs a session that has already finished. Useful for backfilling data or logging sessions tracked elsewhere. Checks for overlaps with existing sessions.
- **Options:**
  - `-r, --range <range_string>`: Specify the time range (e.g., `"09:00 - 10:30"`, `"8:00 AM - 1:15 PM"`). Requires HH:mm or hh:mm A format.
  - `-L, --duration <duration_string>`: Specify the duration ending _now_ (e.g., `"45m"`, `"1h 30m"`, `"2h"`). Accepts hours (h) and minutes (m).
  - `-d, --date <YYYY-MM-DD|today|yesterday>`: Specify the date for the session. **Only applicable with `--range`**. Defaults to `today` if omitted with `--range`. Cannot be used with `--duration`.
- **Examples:**

  ```bash
  # Add session using a range on today's date (default)
  time-cli add --range "14:00 - 15:30"

  # Add session using a range with AM/PM on a specific date
  time-cli add --range "8:30 AM - 11:00 AM" --date 2024-05-20

  # Add session using a range on yesterday's date
  time-cli add --range "20:00 - 21:15" --date yesterday

  # Add a session that lasted 1 hour and 15 minutes, ending now
  time-cli add --duration "1h 15m"

  # Add a session that lasted 30 minutes, ending now
  time-cli add --duration "30m"
  ```

---

### `time-cli list`

Lists completed sessions.

- **Description:** Displays a table of sessions with their ID (shortened), date, start time, end time, and duration.
- **Options:**
  - `-d, --date <YYYY-MM-DD|today|yesterday|tomorrow>`: Filter sessions for a specific local date. Defaults to `today`. Ignored if `-a` is used.
  - `-a, --all`: List all recorded sessions, ignoring any date filter.
- **Examples:**

  ```bash
  # List sessions for today (default)
  time-cli list

  # List sessions for yesterday
  time-cli list -d yesterday

  # List sessions for a specific date
  time-cli list -d 2024-05-19

  # List all sessions ever recorded
  time-cli list -a
  ```

---

### `time-cli edit <id>`

Edits the start and/or end time of an existing completed session.

- **Description:** Allows modification of session boundaries. Requires the unique short ID (first 6 characters) of the session. Checks for overlaps after edits.
- **Arguments:**
  - `<id>`: The short ID (first 6 characters) of the session to edit.
- **Options:**
  - `-s, --start <time|adjustment>`: New start time. Can be absolute (e.g., `"09:00 AM"`, `"14:00"`) or a relative adjustment from the original start time (e.g., `"+15m"`, `"-1h"`).
  - `-e, --end <time|adjustment>`: New end time. Can be absolute (e.g., `"11:30 AM"`, `"16:00"`) or a relative adjustment from the original end time (e.g., `"+30m"`, `"-45m"`).
- **Examples:**

  ```bash
  # Change the start time of session abc123 to 9:00 AM
  time-cli edit abc123 --start "09:00 AM"

  # Adjust the end time of session def456 forward by 15 minutes
  time-cli edit def456 --end "+15m"

  # Adjust the start time back by 1 hour and set end time to 17:00
  time-cli edit xyz789 --start "-1h" --end "17:00"
  ```

---

### `time-cli delete <id>`

Deletes a completed session.

- **Description:** Permanently removes a session log from the database. Requires the unique short ID (first 6 characters). Cannot delete the currently active session.
- **Arguments:**
  - `<id>`: The short ID (first 6 characters) of the session to delete.
- **Options:** None
- **Example:**
  ```bash
  time-cli delete abc123
  ```

---

### `time-cli eta`

Calculates the remaining time to reach the daily goal (8 hours).

- **Description:** Shows the total time logged for the current local day and the time still needed to reach the 8-hour goal.
- **Options:** None
- **Example:**
  ```bash
  time-cli eta
  ```

---

### `time-cli summary`

Shows a summary of total time per day and goal status.

- **Description:** Displays a table summarizing total study time for each local day, indicating whether the 8-hour goal was met (✅/❌).
- **Options:**
  - `-m, --month <YYYY-MM>`: Filter the summary to a specific month (e.g., `"2024-05"`).
  - `-y, --year <YYYY>`: Filter the summary to a specific year (e.g., `"2024"`). Cannot be used with `-m`.
- **Examples:**

  ```bash
  # Show summary for all time
  time-cli summary

  # Show summary for May 2024
  time-cli summary --month 2024-05

  # Show summary for the year 2023
  time-cli summary --year 2023
  ```

---

### `time-cli report`

Shows statistics on study habits and patterns.

- **Description:** Provides a detailed report including the tracking period, total active days, total study time, average daily time, goal success rate, best/worst days, weekly patterns (time per day of the week), and consistency. Based on local time.
- **Options:** None
- **Example:**
  ```bash
  time-cli report
  ```

---

### `time-cli export`

Exports logged sessions to a JSON file.

- **Description:** Saves completed sessions to a JSON file. Useful for backups or analysis in other tools. Filters based on the _local_ start date of sessions.
- **Options:**
  - `-o, --output <filepath>`: Specify the output file path. Defaults to a timestamped file in a default 'exports' directory within the application's data folder.
  - `-s, --start <YYYY-MM-DD>`: Export sessions starting on or after this local date (inclusive).
  - `-e, --end <YYYY-MM-DD>`: Export sessions starting on or before this local date (inclusive).
- **Examples:**

  ```bash
  # Export all sessions to a default timestamped file
  time-cli export

  # Export sessions from May 2024 to a specific file
  time-cli export -s 2024-05-01 -e 2024-05-31 -o ./may_2024_backup.json
  ```

---

### `time-cli import <filepath>`

Imports logged sessions from a JSON file.

- **Description:** Loads session data from a JSON file (expected format matches the export). Checks for overlaps with existing data. Generates new unique IDs for imported sessions.
- **Arguments:**
  - `<filepath>`: The path to the JSON file to import.
- **Options:**
  - `--skip-overlaps`: If specified, sessions in the file that overlap with existing database sessions will be skipped instead of causing the import to abort.
- **Example:**

  ```bash
  # Import sessions, aborting if overlaps are found
  time-cli import ./my_backup.json

  # Import sessions, skipping any that overlap
  time-cli import ./my_backup.json --skip-overlaps
  ```

## Important Notes

- **Data Storage:** Session data is stored in a local SQLite database file (`timetracker.db`). The location is determined by operating system standards (using `env-paths`). Typical locations:
  - Linux: `~/.local/share/time-cli-nodejs/Data/`
  - macOS: `~/Library/Application Support/time-cli-nodejs/Data/`
  - Windows: `C:\Users\<user>\AppData\Local\time-cli-nodejs\Data\`
- **Timezones:** Timestamps are stored internally in UTC. However, filtering and display for commands like `list`, `summary`, `report`, and `eta` are based on your computer's **local timezone**.
- **IDs:** Sessions are identified internally by a full UUID. For convenience, commands like `edit` and `delete` use a shortened, 6-character version of the ID. If multiple sessions happen to share the same first 6 characters (extremely unlikely), the operation will be safely aborted.
- **Backup:** You can use the `export` and `import` commands for basic backup and restore. Alternatively, you can manually copy the `timetracker.db` file from the data directory mentioned above.
- **Daily Goal:** The daily goal used for `eta` and `summary`/`report` status is currently fixed at **8 hours** (28800 seconds).

## Contributing

Contributions, issues, and feature requests are welcome! Please open an issue on the repository's issue tracker to discuss changes.

## License

This project is licensed under the MIT License - see the LICENSE file (if included) or the [MIT License text](https://opensource.org/licenses/MIT) for details.
