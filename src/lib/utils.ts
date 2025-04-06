import chalk from 'chalk';

// --- Standard Formatting Functions ---

/**
 * Formats a Unix timestamp (in seconds) into a human-readable date & time string.
 * Returns 'Active' (yellow) if the input is null.
 */
export function formatTimestamp(timestampSeconds: number | null): string {
    if (timestampSeconds === null) {
        return chalk.yellow('Active');
    }
    try {
        const date = new Date(timestampSeconds * 1000);
        // Using toLocaleString for a common local format (Date + Time)
        return date.toLocaleString();
    } catch (e) {
        return chalk.red('Invalid Timestamp');
    }
}

/**
 * Formats only the date part of a Unix timestamp (in seconds) into YYYY-MM-DD format.
 * Returns 'Invalid Date' (red) on error.
 */
export function formatDate(timestampSeconds: number): string {
     try {
        const date = new Date(timestampSeconds * 1000);

        // Extract date components
        const year = date.getFullYear();
        // getMonth() is 0-indexed, so add 1
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Pad with leading zero if needed
        const day = date.getDate().toString().padStart(2, '0'); // Pad with leading zero if needed

        // Combine into YYYY-MM-DD format
        return `${year}-${month}-${day}`;

    } catch (e) {
        return chalk.red('Invalid Date');
    }
}

/**
 * Formats only the time part of a Unix timestamp (in seconds).
 * Returns '--:--:--' (gray) if input is null, 'Invalid Time' (red) on error.
 */
export function formatTime(timestampSeconds: number | null): string {
    if (timestampSeconds === null) {
        // Indicates time is not applicable (e.g., for an active session's end time)
        return chalk.gray('--:--:--');
    }
    try {
        const date = new Date(timestampSeconds * 1000);
        // Using toLocaleTimeString for the locale-specific time part
        return date.toLocaleTimeString();
    } catch (e) {
        return chalk.red('Invalid Time');
    }
}

/**
 * Formats a duration in seconds into a human-readable string (e.g., 1h 23m 45s).
 * Returns 'N/A' (gray) for invalid input, '0s' for zero duration.
 * Handles potential floating point numbers by flooring.
 */
export function formatDuration(totalSeconds: number): string {
    // Ensure totalSeconds is treated as a number, round down if float (e.g., from average)
    const secondsInt = Math.floor(Number(totalSeconds));

    if (secondsInt < 0 || isNaN(secondsInt)) {
        return chalk.gray('N/A');
    }
    if (secondsInt === 0) {
        return '0s';
    }

    const hours = Math.floor(secondsInt / 3600);
    const minutes = Math.floor((secondsInt % 3600) / 60);
    const seconds = Math.floor(secondsInt % 60);

    let parts: string[] = [];
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    // Show minutes if hours > 0 OR if minutes > 0 (even if hours is 0)
    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}m`);
    }
    // Show seconds if duration is less than a minute OR if there are hours/minutes
    // OR if seconds > 0 (covers cases like 1h 0m 5s)
    if (seconds > 0 || parts.length === 0) {
       parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}


// --- Filter Parsing Utilities ---

// Define supported filter operators (expand if needed)
export type FilterOperator = '=' | '>' | '>=' | '<' | '<=' | '!=';

// Structure to hold parsed filter information
export interface ParsedFilter {
    key: string;            // The filter field (e.g., 'date', 'duration')
    operator: FilterOperator; // The comparison operator (e.g., '=', '>=')
    value: string;          // The raw value string from the filter
    valueSeconds?: number | null;  // For duration/time filters, the parsed value in seconds
}

/**
 * Parses a filter string (e.g., "duration>=1h30m") into its components.
 * Returns null if the format is invalid or operator is unsupported.
 * Currently supports operators: =, >, >=
 */
export function parseFilterString(filterStr: string): ParsedFilter | null {
    // Regex captures: key (word chars), operator (=, >, >=, <, <=, !=), value (rest)
    // Allows optional whitespace around operator
    const match = filterStr.trim().match(/^(\w+)\s*([=><!]=?)\s*(.+)$/);

    if (!match) {
        console.error(chalk.red(`Invalid filter format: "${filterStr}". Use format: key[=|>=|>]value`));
        return null;
    }

    const [, key, operator, value] = match;

    // Validate supported operators (can be expanded)
    const supportedOperators = ['=', '>', '>=']; // Add '<', '<=', '!=' later if implemented
    if (!supportedOperators.includes(operator)) {
         console.error(chalk.red(`Unsupported operator "${operator}" in filter: "${filterStr}". Supported: ${supportedOperators.join(', ')}`));
         return null;
    }

    const parsed: ParsedFilter = {
        key: key.toLowerCase(),         // Normalize key to lowercase
        operator: operator as FilterOperator,
        value: value.trim()             // Trim whitespace from value
    };

    // Pre-parse duration/total/avg values to seconds if the key matches
    if (['duration', 'total', 'avg'].includes(parsed.key)) {
        parsed.valueSeconds = parseDurationToSeconds(parsed.value);
        // Check if parsing failed (returned null)
        if (parsed.valueSeconds === null) {
            console.error(chalk.red(`Invalid duration format "${parsed.value}" for key "${parsed.key}" in filter: "${filterStr}"`));
            console.error(chalk.yellow('  Use formats like: "1h", "30m", "1h 45m", "2h 5m 10s"'));
            return null; // Indicate parsing failure
        }
    }

    return parsed; // Return the successfully parsed filter object
}

/**
 * Parses a duration string (e.g., "1h30m", "45m", "2h", "1h 5s") into total seconds.
 * Returns null if the format is invalid or no time units are found.
 */
export function parseDurationToSeconds(durationStr: string): number | null {
    // Regex to capture hours (h), minutes (m), and seconds (s) components. Optional whitespace. Case-insensitive.
    const durationRegex = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i;
    const trimmedStr = durationStr.trim();
    const match = trimmedStr.match(durationRegex);

    // Check if regex matched and if the string wasn't just empty/whitespace
    if (!match || trimmedStr === '') {
        return null; // Invalid format or empty string
    }

    // Extract captured groups, defaulting to '0' if a unit wasn't present
    const [, hoursStr, minutesStr, secondsStr] = match;
    const hours = parseInt(hoursStr || '0', 10);
    const minutes = parseInt(minutesStr || '0', 10);
    const seconds = parseInt(secondsStr || '0', 10);

    // Double-check parsing results (should be redundant with regex but safe)
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        return null;
    }

    // Check if *any* time unit was actually specified.
    // If all are zero AND the original string didn't contain any digits, it's invalid (e.g., "h m s")
    if (hours === 0 && minutes === 0 && seconds === 0 && !/\d/.test(trimmedStr)) {
        return null;
    }

    // Calculate total seconds
    return (hours * 3600) + (minutes * 60) + seconds;
}