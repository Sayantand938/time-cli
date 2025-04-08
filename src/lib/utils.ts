// // import chalk from 'chalk';

// // // --- Standard Formatting Functions ---

// // /**
// //  * Formats a Unix timestamp (in seconds) into a human-readable date & time string.
// //  * Returns 'Active' (yellow) if the input is null.
// //  */
// // export function formatTimestamp(timestampSeconds: number | null): string {
// //     if (timestampSeconds === null) {
// //         return chalk.yellow('Active');
// //     }
// //     try {
// //         const date = new Date(timestampSeconds * 1000);
// //         // Using toLocaleString for a common local format (Date + Time)
// //         return date.toLocaleString();
// //     } catch (e) {
// //         return chalk.red('Invalid Timestamp');
// //     }
// // }

// // /**
// //  * Formats only the date part of a Unix timestamp (in seconds) into YYYY-MM-DD format.
// //  * Returns 'Invalid Date' (red) on error.
// //  */
// // export function formatDate(timestampSeconds: number): string {
// //      try {
// //         const date = new Date(timestampSeconds * 1000);

// //         // Extract date components
// //         const year = date.getFullYear();
// //         // getMonth() is 0-indexed, so add 1
// //         const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Pad with leading zero if needed
// //         const day = date.getDate().toString().padStart(2, '0'); // Pad with leading zero if needed

// //         // Combine into YYYY-MM-DD format
// //         return `${year}-${month}-${day}`;

// //     } catch (e) {
// //         return chalk.red('Invalid Date');
// //     }
// // }

// // /**
// //  * Formats only the time part of a Unix timestamp (in seconds).
// //  * Returns '--:--:--' (gray) if input is null, 'Invalid Time' (red) on error.
// //  */
// // export function formatTime(timestampSeconds: number | null): string {
// //     if (timestampSeconds === null) {
// //         // Indicates time is not applicable (e.g., for an active session's end time)
// //         return chalk.gray('--:--:--');
// //     }
// //     try {
// //         const date = new Date(timestampSeconds * 1000);
// //         // Using toLocaleTimeString for the locale-specific time part
// //         return date.toLocaleTimeString();
// //     } catch (e) {
// //         return chalk.red('Invalid Time');
// //     }
// // }

// // /**
// //  * Formats a duration in seconds into a human-readable string (e.g., 1h 23m 45s).
// //  * Returns 'N/A' (gray) for invalid input, '0s' for zero duration.
// //  * Handles potential floating point numbers by flooring.
// //  */
// // export function formatDuration(totalSeconds: number): string {
// //     // Ensure totalSeconds is treated as a number, round down if float (e.g., from average)
// //     const secondsInt = Math.floor(Number(totalSeconds));

// //     if (secondsInt < 0 || isNaN(secondsInt)) {
// //         return chalk.gray('N/A');
// //     }
// //     if (secondsInt === 0) {
// //         return '0s';
// //     }

// //     const hours = Math.floor(secondsInt / 3600);
// //     const minutes = Math.floor((secondsInt % 3600) / 60);
// //     const seconds = Math.floor(secondsInt % 60);

// //     let parts: string[] = [];
// //     if (hours > 0) {
// //         parts.push(`${hours}h`);
// //     }
// //     // Show minutes if hours > 0 OR if minutes > 0 (even if hours is 0)
// //     if (minutes > 0 || hours > 0) {
// //         parts.push(`${minutes}m`);
// //     }
// //     // Show seconds if duration is less than a minute OR if there are hours/minutes
// //     // OR if seconds > 0 (covers cases like 1h 0m 5s)
// //     if (seconds > 0 || parts.length === 0) {
// //        parts.push(`${seconds}s`);
// //     }

// //     return parts.join(' ');
// // }


// // // --- Filter Parsing Utilities ---

// // // Define supported filter operators (expand if needed)
// // export type FilterOperator = '=' | '>' | '>=' | '<' | '<=' | '!=';

// // // Structure to hold parsed filter information
// // export interface ParsedFilter {
// //     key: string;            // The filter field (e.g., 'date', 'duration')
// //     operator: FilterOperator; // The comparison operator (e.g., '=', '>=')
// //     value: string;          // The raw value string from the filter
// //     valueSeconds?: number | null;  // For duration/time filters, the parsed value in seconds
// // }

// // /**
// //  * Parses a filter string (e.g., "duration>=1h30m") into its components.
// //  * Returns null if the format is invalid or operator is unsupported.
// //  * Currently supports operators: =, >, >=
// //  */
// // export function parseFilterString(filterStr: string): ParsedFilter | null {
// //     // Regex captures: key (word chars), operator (=, >, >=, <, <=, !=), value (rest)
// //     // Allows optional whitespace around operator
// //     const match = filterStr.trim().match(/^(\w+)\s*([=><!]=?)\s*(.+)$/);

// //     if (!match) {
// //         console.error(chalk.red(`Invalid filter format: "${filterStr}". Use format: key[=|>=|>]value`));
// //         return null;
// //     }

// //     const [, key, operator, value] = match;

// //     // Validate supported operators (can be expanded)
// //     const supportedOperators = ['=', '>', '>=']; // Add '<', '<=', '!=' later if implemented
// //     if (!supportedOperators.includes(operator)) {
// //          console.error(chalk.red(`Unsupported operator "${operator}" in filter: "${filterStr}". Supported: ${supportedOperators.join(', ')}`));
// //          return null;
// //     }

// //     const parsed: ParsedFilter = {
// //         key: key.toLowerCase(),         // Normalize key to lowercase
// //         operator: operator as FilterOperator,
// //         value: value.trim()             // Trim whitespace from value
// //     };

// //     // Pre-parse duration/total/avg values to seconds if the key matches
// //     if (['duration', 'total', 'avg'].includes(parsed.key)) {
// //         parsed.valueSeconds = parseDurationToSeconds(parsed.value);
// //         // Check if parsing failed (returned null)
// //         if (parsed.valueSeconds === null) {
// //             console.error(chalk.red(`Invalid duration format "${parsed.value}" for key "${parsed.key}" in filter: "${filterStr}"`));
// //             console.error(chalk.yellow('  Use formats like: "1h", "30m", "1h 45m", "2h 5m 10s"'));
// //             return null; // Indicate parsing failure
// //         }
// //     }

// //     return parsed; // Return the successfully parsed filter object
// // }

// // /**
// //  * Parses a duration string (e.g., "1h30m", "45m", "2h", "1h 5s") into total seconds.
// //  * Returns null if the format is invalid or no time units are found.
// //  */
// // export function parseDurationToSeconds(durationStr: string): number | null {
// //     // Regex to capture hours (h), minutes (m), and seconds (s) components. Optional whitespace. Case-insensitive.
// //     const durationRegex = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i;
// //     const trimmedStr = durationStr.trim();
// //     const match = trimmedStr.match(durationRegex);

// //     // Check if regex matched and if the string wasn't just empty/whitespace
// //     if (!match || trimmedStr === '') {
// //         return null; // Invalid format or empty string
// //     }

// //     // Extract captured groups, defaulting to '0' if a unit wasn't present
// //     const [, hoursStr, minutesStr, secondsStr] = match;
// //     const hours = parseInt(hoursStr || '0', 10);
// //     const minutes = parseInt(minutesStr || '0', 10);
// //     const seconds = parseInt(secondsStr || '0', 10);

// //     // Double-check parsing results (should be redundant with regex but safe)
// //     if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
// //         return null;
// //     }

// //     // Check if *any* time unit was actually specified.
// //     // If all are zero AND the original string didn't contain any digits, it's invalid (e.g., "h m s")
// //     if (hours === 0 && minutes === 0 && seconds === 0 && !/\d/.test(trimmedStr)) {
// //         return null;
// //     }

// //     // Calculate total seconds
// //     return (hours * 3600) + (minutes * 60) + seconds;
// // }


// import chalk from 'chalk';

// // --- Standard Formatting Functions ---

// /**
//  * Formats a Unix timestamp (in seconds) into a human-readable date & time string.
//  * Returns 'Active' (yellow) if the input is null.
//  */
// export function formatTimestamp(timestampSeconds: number | null): string {
//     if (timestampSeconds === null) {
//         return chalk.yellow('Active');
//     }
//     try {
//         const date = new Date(timestampSeconds * 1000);
//         // Using toLocaleString for a common local format (Date + Time)
//         return date.toLocaleString();
//     } catch (e) {
//         return chalk.red('Invalid Timestamp');
//     }
// }

// /**
//  * Formats only the date part of a Unix timestamp (in seconds) into YYYY-MM-DD format.
//  * Returns 'Invalid Date' (red) on error.
//  */
// export function formatDate(timestampSeconds: number): string {
//      try {
//         const date = new Date(timestampSeconds * 1000);

//         // Extract date components
//         const year = date.getFullYear();
//         // getMonth() is 0-indexed, so add 1
//         const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Pad with leading zero if needed
//         const day = date.getDate().toString().padStart(2, '0'); // Pad with leading zero if needed

//         // Combine into YYYY-MM-DD format
//         return `${year}-${month}-${day}`;

//     } catch (e) {
//         return chalk.red('Invalid Date');
//     }
// }

// /**
//  * [DEPRECATED for table output, use formatTimeAmPm instead]
//  * Formats only the time part of a Unix timestamp (in seconds).
//  * Returns '--:--:--' (gray) if input is null, 'Invalid Time' (red) on error.
//  */
// export function formatTime(timestampSeconds: number | null): string {
//     if (timestampSeconds === null) {
//         // Indicates time is not applicable (e.g., for an active session's end time)
//         return chalk.gray('--:--:--');
//     }
//     try {
//         const date = new Date(timestampSeconds * 1000);
//         // Using toLocaleTimeString for the locale-specific time part
//         return date.toLocaleTimeString();
//     } catch (e) {
//         return chalk.red('Invalid Time');
//     }
// }

// /**
//  * Formats a Unix timestamp (in seconds) into hh:mm AM/PM format.
//  * Returns 'Invalid Time' (red) on error.
//  * NOTE: Does not handle null values, caller should handle active sessions.
//  */
// export function formatTimeAmPm(timestampSeconds: number): string {
//     try {
//         const date = new Date(timestampSeconds * 1000);
//         let hours = date.getHours();
//         const minutes = date.getMinutes();
//         const ampm = hours >= 12 ? 'PM' : 'AM';

//         hours = hours % 12;
//         hours = hours ? hours : 12; // the hour '0' should be '12'

//         const hoursStr = hours.toString().padStart(2, '0');
//         const minutesStr = minutes.toString().padStart(2, '0');

//         return `${hoursStr}:${minutesStr} ${ampm}`;
//     } catch (e) {
//         return chalk.red('Invalid Time');
//     }
// }


// /**
//  * [DEPRECATED for table output, use formatDurationAsHHMM instead]
//  * Formats a duration in seconds into a human-readable string (e.g., 1h 23m 45s).
//  * Returns 'N/A' (gray) for invalid input, '0s' for zero duration.
//  * Handles potential floating point numbers by flooring.
//  */
// export function formatDuration(totalSeconds: number): string {
//     // Ensure totalSeconds is treated as a number, round down if float (e.g., from average)
//     const secondsInt = Math.floor(Number(totalSeconds));

//     if (secondsInt < 0 || isNaN(secondsInt)) {
//         return chalk.gray('N/A');
//     }
//     if (secondsInt === 0) {
//         return '0s';
//     }

//     const hours = Math.floor(secondsInt / 3600);
//     const minutes = Math.floor((secondsInt % 3600) / 60);
//     const seconds = Math.floor(secondsInt % 60);

//     let parts: string[] = [];
//     if (hours > 0) {
//         parts.push(`${hours}h`);
//     }
//     // Show minutes if hours > 0 OR if minutes > 0 (even if hours is 0)
//     if (minutes > 0 || hours > 0) {
//         parts.push(`${minutes}m`);
//     }
//     // Show seconds if duration is less than a minute OR if there are hours/minutes
//     // OR if seconds > 0 (covers cases like 1h 0m 5s)
//     if (seconds > 0 || parts.length === 0) {
//        parts.push(`${seconds}s`);
//     }

//     return parts.join(' ');
// }

// /**
//  * Formats a duration in seconds into hh:mm format.
//  * Returns 'N/A' (gray) for invalid input, '00:00' for zero duration.
//  * Handles potential floating point numbers by flooring.
//  */
// export function formatDurationAsHHMM(totalSeconds: number): string {
//     // Ensure totalSeconds is treated as a number, round down if float
//     const secondsInt = Math.floor(Number(totalSeconds));

//     if (secondsInt < 0 || isNaN(secondsInt)) {
//         return chalk.gray('N/A');
//     }
//     if (secondsInt === 0) {
//         return '00:00';
//     }

//     const totalMinutes = Math.floor(secondsInt / 60);
//     const hours = Math.floor(totalMinutes / 60);
//     const minutes = totalMinutes % 60;

//     const hoursStr = hours.toString().padStart(2, '0');
//     const minutesStr = minutes.toString().padStart(2, '0');

//     return `${hoursStr}:${minutesStr}`;
// }


// // --- Filter Parsing Utilities ---

// // Define supported filter operators (expand if needed)
// export type FilterOperator = '=' | '>' | '>=' | '<' | '<=' | '!=';

// // Structure to hold parsed filter information
// export interface ParsedFilter {
//     key: string;            // The filter field (e.g., 'date', 'duration')
//     operator: FilterOperator; // The comparison operator (e.g., '=', '>=')
//     value: string;          // The raw value string from the filter
//     valueSeconds?: number | null;  // For duration/time filters, the parsed value in seconds
// }

// /**
//  * Parses a filter string (e.g., "duration>=1h30m") into its components.
//  * Returns null if the format is invalid or operator is unsupported.
//  * Currently supports operators: =, >, >=
//  */
// export function parseFilterString(filterStr: string): ParsedFilter | null {
//     // Regex captures: key (word chars), operator (=, >, >=, <, <=, !=), value (rest)
//     // Allows optional whitespace around operator
//     const match = filterStr.trim().match(/^(\w+)\s*([=><!]=?)\s*(.+)$/);

//     if (!match) {
//         console.error(chalk.red(`Invalid filter format: "${filterStr}". Use format: key[=|>=|>]value`));
//         return null;
//     }

//     const [, key, operator, value] = match;

//     // Validate supported operators (can be expanded)
//     const supportedOperators = ['=', '>', '>=']; // Add '<', '<=', '!=' later if implemented
//     if (!supportedOperators.includes(operator)) {
//          console.error(chalk.red(`Unsupported operator "${operator}" in filter: "${filterStr}". Supported: ${supportedOperators.join(', ')}`));
//          return null;
//     }

//     const parsed: ParsedFilter = {
//         key: key.toLowerCase(),         // Normalize key to lowercase
//         operator: operator as FilterOperator,
//         value: value.trim()             // Trim whitespace from value
//     };

//     // Pre-parse duration/total/avg values to seconds if the key matches
//     if (['duration', 'total', 'avg'].includes(parsed.key)) {
//         parsed.valueSeconds = parseDurationToSeconds(parsed.value);
//         // Check if parsing failed (returned null)
//         if (parsed.valueSeconds === null) {
//             console.error(chalk.red(`Invalid duration format "${parsed.value}" for key "${parsed.key}" in filter: "${filterStr}"`));
//             console.error(chalk.yellow('  Use formats like: "1h", "30m", "1h 45m", "2h 5m 10s", or just total seconds/minutes e.g. "90m", "5400s"'));
//             return null; // Indicate parsing failure
//         }
//     }

//     return parsed; // Return the successfully parsed filter object
// }

// /**
//  * Parses a duration string (e.g., "1h30m", "45m", "2h", "1h 5s") into total seconds.
//  * Returns null if the format is invalid or no time units are found.
//  * Supports simple formats like "hh:mm" too.
//  */
// export function parseDurationToSeconds(durationStr: string): number | null {
//     const trimmedStr = durationStr.trim().toLowerCase();

//     // Try hh:mm format first
//     const hhmmMatch = trimmedStr.match(/^(\d{1,2}):(\d{2})$/);
//     if (hhmmMatch) {
//         const hours = parseInt(hhmmMatch[1], 10);
//         const minutes = parseInt(hhmmMatch[2], 10);
//         if (!isNaN(hours) && !isNaN(minutes) && minutes >= 0 && minutes < 60 && hours >=0) {
//              return (hours * 3600) + (minutes * 60);
//         }
//     }


//     // Regex to capture hours (h), minutes (m), and seconds (s) components. Optional whitespace. Case-insensitive.
//     const durationRegex = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i;
//     const match = trimmedStr.match(durationRegex);

//     // Check if regex matched and if the string wasn't just empty/whitespace
//     if (!match || trimmedStr === '' || (!hhmmMatch && trimmedStr.includes(':'))) { // Added check for ':' if hhmmMatch failed
//         return null; // Invalid format or empty string
//     }

//     // Extract captured groups, defaulting to '0' if a unit wasn't present
//     const [, hoursStr, minutesStr, secondsStr] = match;
//     const hours = parseInt(hoursStr || '0', 10);
//     const minutes = parseInt(minutesStr || '0', 10);
//     const seconds = parseInt(secondsStr || '0', 10);

//     // Double-check parsing results (should be redundant with regex but safe)
//     if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
//         return null;
//     }

//     // Check if *any* time unit was actually specified.
//     // If all are zero AND the original string didn't contain any digits, it's invalid (e.g., "h m s")
//     if (hours === 0 && minutes === 0 && seconds === 0 && !/\d/.test(trimmedStr)) {
//         return null;
//     }

//     // Calculate total seconds
//     return (hours * 3600) + (minutes * 60) + seconds;
// }



import chalk from 'chalk';

// --- Helper: Format Date Object ---
/**
 * Formats a Date object into YYYY-MM-DD format.
 * Returns 'Invalid Date' (red) on error.
 */
function formatDateObject(date: Date): string {
    try {
        if (isNaN(date.getTime())) {
             return chalk.red('Invalid Date Obj');
        }
        const year = date.getFullYear();
        // getMonth() is 0-indexed, so add 1
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Pad with leading zero if needed
        const day = date.getDate().toString().padStart(2, '0'); // Pad with leading zero if needed
        // Combine into YYYY-MM-DD format
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error(chalk.red("Error formatting date object:"), e)
        return chalk.red('Invalid Date Obj');
    }
}


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
 * Uses the helper formatDateObject internally.
 */
export function formatDate(timestampSeconds: number): string {
     try {
        const date = new Date(timestampSeconds * 1000);
        return formatDateObject(date); // Reuse the helper
    } catch (e) {
        return chalk.red('Invalid Date'); // Should be caught by formatDateObject but good fallback
    }
}

/**
 * [DEPRECATED for table output, use formatTimeAmPm instead]
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
 * Formats a Unix timestamp (in seconds) into hh:mm AM/PM format.
 * Returns 'Invalid Time' (red) on error.
 * NOTE: Does not handle null values, caller should handle active sessions.
 */
export function formatTimeAmPm(timestampSeconds: number): string {
    try {
        const date = new Date(timestampSeconds * 1000);
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'

        const hoursStr = hours.toString().padStart(2, '0');
        const minutesStr = minutes.toString().padStart(2, '0');

        return `${hoursStr}:${minutesStr} ${ampm}`;
    } catch (e) {
        return chalk.red('Invalid Time');
    }
}


/**
 * [DEPRECATED for table output, use formatDurationAsHHMM instead]
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

/**
 * Formats a duration in seconds into hh:mm format.
 * Returns 'N/A' (gray) for invalid input, '00:00' for zero duration.
 * Handles potential floating point numbers by flooring.
 */
export function formatDurationAsHHMM(totalSeconds: number): string {
    // Ensure totalSeconds is treated as a number, round down if float
    const secondsInt = Math.floor(Number(totalSeconds));

    if (secondsInt < 0 || isNaN(secondsInt)) {
        return chalk.gray('N/A');
    }
    if (secondsInt === 0) {
        return '00:00';
    }

    const totalMinutes = Math.floor(secondsInt / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');

    return `${hoursStr}:${minutesStr}`;
}


// --- Filter Parsing Utilities ---

// Define supported filter operators (expand if needed)
export type FilterOperator = '=' | '>' | '>=' | '<' | '<=' | '!=';

// Structure to hold parsed filter information
export interface ParsedFilter {
    key: string;            // The filter field (e.g., 'date', 'duration')
    operator: FilterOperator; // The comparison operator (e.g., '=', '>=')
    value: string;          // The raw value string, potentially modified for relative dates
    valueSeconds?: number | null;  // For duration/time filters, the parsed value in seconds
}

/**
 * Parses a filter string (e.g., "duration>=1h30m", "date=today") into its components.
 * Converts relative date keywords ('today', 'yesterday', 'tomorrow') for 'date=' filters.
 * Returns null if the format is invalid or operator is unsupported.
 * Currently supports operators: =, >, >= for duration/total/avg; = for date/status.
 */
export function parseFilterString(filterStr: string): ParsedFilter | null {
    // Regex captures: key (word chars), operator (=, >, >=, <, <=, !=), value (rest)
    // Allows optional whitespace around operator
    const match = filterStr.trim().match(/^(\w+)\s*([=><!]=?)\s*(.+)$/);

    if (!match) {
        console.error(chalk.red(`Invalid filter format: "${filterStr}". Use format: key[=|>=|>]value`));
        return null;
    }

    const [, keyRaw, operatorRaw, valueRaw] = match;
    const key = keyRaw.toLowerCase();
    const operator = operatorRaw as FilterOperator;
    let value = valueRaw.trim();

    // --- Operator Validation (Adjust based on key later if needed) ---
    const supportedOperators = ['=', '>', '>=']; // Base supported set
    if (!supportedOperators.includes(operator)) {
         console.error(chalk.red(`Unsupported operator "${operator}" in filter: "${filterStr}". Supported: ${supportedOperators.join(', ')}`));
         return null;
    }
    // --- Specific Key/Operator validation ---
     if ((key === 'date' || key === 'status') && operator !== '=') {
        console.error(chalk.red(`Operator "${operator}" is not supported for key "${key}". Only '=' is allowed.`));
        return null;
    }


    const parsed: ParsedFilter = { key, operator, value }; // value might be updated below

    // --- Value Processing ---

    // 1. Relative Date Conversion (only for 'date' key with '=' operator)
    if (key === 'date' && operator === '=') {
        const lowerValue = value.toLowerCase();
        const today = new Date();
        let targetDate: Date | null = null;

        // Reset time part to ensure consistent date comparison
        today.setHours(0, 0, 0, 0);

        if (lowerValue === 'today') {
            targetDate = today;
        } else if (lowerValue === 'yesterday') {
            targetDate = new Date(today); // Clone today
            targetDate.setDate(today.getDate() - 1);
        } else if (lowerValue === 'tomorrow') {
             targetDate = new Date(today); // Clone today
             targetDate.setDate(today.getDate() + 1);
        }

        if (targetDate) {
            const formattedDate = formatDateObject(targetDate);
            if (formattedDate.startsWith(chalk.red('Invalid'))) {
                 console.error(chalk.red(`Internal error formatting relative date for "${value}".`));
                 return null;
            }
            parsed.value = formattedDate; // Update the value to YYYY-MM-DD string
        }
        // If it's not a relative keyword, keep the original value (assume it's YYYY-MM-DD)
        // TODO: Add validation for YYYY-MM-DD format here?
    }

    // 2. Pre-parse duration/total/avg values to seconds
    if (['duration', 'total', 'avg'].includes(key)) {
        // Check if the operator is valid for duration keys
        if (!['=', '>', '>='].includes(operator)) { // Add <, <=, != if implemented later
             console.error(chalk.red(`Operator "${operator}" is not supported for key "${key}". Supported: =, >, >=`));
             return null;
        }

        parsed.valueSeconds = parseDurationToSeconds(value); // Use original 'value' here
        // Check if parsing failed (returned null)
        if (parsed.valueSeconds === null) {
            console.error(chalk.red(`Invalid duration format "${value}" for key "${key}" in filter: "${filterStr}"`));
            console.error(chalk.yellow('  Use formats like: "1h", "30m", "1h 45m", "2h 5m 10s", "hh:mm"'));
            return null; // Indicate parsing failure
        }
    }

    return parsed; // Return the successfully parsed (and potentially modified) filter object
}

/**
 * Parses a duration string (e.g., "1h30m", "45m", "2h", "1h 5s") into total seconds.
 * Returns null if the format is invalid or no time units are found.
 * Supports simple formats like "hh:mm" too.
 */
export function parseDurationToSeconds(durationStr: string): number | null {
    const trimmedStr = durationStr.trim().toLowerCase();

    // Try hh:mm format first
    const hhmmMatch = trimmedStr.match(/^(\d{1,3}):(\d{2})$/); // Allow more than 99 hours e.g. 120:30
    if (hhmmMatch) {
        const hours = parseInt(hhmmMatch[1], 10);
        const minutes = parseInt(hhmmMatch[2], 10);
        if (!isNaN(hours) && !isNaN(minutes) && minutes >= 0 && minutes < 60 && hours >=0) {
             return (hours * 3600) + (minutes * 60);
        }
    }


    // Regex to capture hours (h), minutes (m), and seconds (s) components. Optional whitespace. Case-insensitive.
    // Allows optional parts.
    const durationRegex = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i;
    const match = trimmedStr.match(durationRegex);

    // Check if regex matched AND the string wasn't just empty/whitespace AND it wasn't an invalid hh:mm format
    if (!match || trimmedStr === '' || (!hhmmMatch && trimmedStr.includes(':'))) {
        return null; // Invalid format or empty string
    }

    // If only whitespace matched by regex (e.g., " "), return null
    if (!match[1] && !match[2] && !match[3] && /\s+/.test(trimmedStr) && !/\d/.test(trimmedStr)) {
        return null;
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
        // Allow "0", "0s", "0m", "0h" etc.
         if (trimmedStr !== '0' && trimmedStr !== '0s' && trimmedStr !== '0m' && trimmedStr !== '0h' ) {
            return null;
         }
    }

    // Calculate total seconds
    return (hours * 3600) + (minutes * 60) + seconds;
}