import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import durationPlugin from 'dayjs/plugin/duration'; // Renamed import for clarity
import { v4 as uuidv4 } from 'uuid';

// Extend dayjs with necessary plugins
dayjs.extend(customParseFormat);
dayjs.extend(durationPlugin); // Use the renamed import here

export const DAILY_GOAL_SECONDS = 8 * 60 * 60; // 8 hours in seconds = 28800

/**
 * Formats an ISO 8601 timestamp into hh:mm AM/PM format.
 */
export function formatTime(isoTimestamp: string | null | undefined): string {
    if (!isoTimestamp) return 'N/A';
    return dayjs(isoTimestamp).format('hh:mm A');
}

/**
 * Formats an ISO 8601 timestamp into YYYY-MM-DD format.
 */
export function formatDate(isoTimestamp: string | null | undefined): string {
    if (!isoTimestamp) return 'N/A';
    return dayjs(isoTimestamp).format('YYYY-MM-DD');
}

/**
 * Formats a duration in seconds into hh:mm format.
 */
export function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined) return 'N/A';
    // Use the duration plugin directly
    const dur = dayjs.duration(seconds, 'seconds');
    const hours = Math.floor(dur.asHours()).toString().padStart(2, '0');
    const minutes = dur.minutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Generates a new UUID v4.
 */
export function generateUUID(): string {
    return uuidv4();
}

/**
 * Returns the first 6 characters of a UUID.
 */
export function shortenUUID(uuid: string | null | undefined): string {
    if (!uuid) return 'N/A';
    return uuid.substring(0, 6);
}

/**
 * Gets the current timestamp in ISO 8601 format.
 */
export function getCurrentISOTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Validates if a string is in YYYY-MM-DD format.
 */
export function isValidDate(dateString: string): boolean {
    // Use strict parsing ('true' as the third argument)
    return dayjs(dateString, 'YYYY-MM-DD', true).isValid();
}

/**
 * Validates if a string is in YYYY format.
 */
export function isValidYearFormat(yearString: string): boolean {
    return /^\d{4}$/.test(yearString);
}

/**
 * Validates if a string is in YYYY-MM format and represents a valid month.
 */
export function isValidMonthFormat(monthString: string): boolean {
    // Basic format check first
    if (!/^\d{4}-\d{2}$/.test(monthString)) {
        return false;
    }
    // Use dayjs to check if the month part is valid (01-12)
    // We check the first day of the month for validity using strict parsing.
    return dayjs(monthString + '-01', 'YYYY-MM-DD', true).isValid();
}

/**
 * Parses a time string (HH:mm or hh:mm A) and combines it with a given date.
 * @param timeStr The time string to parse.
 * @param referenceDate The dayjs object representing the target date.
 * @returns A dayjs object with the date and parsed time, or null if parsing fails.
 */
export function parseTimeAndCombineWithDate(timeStr: string, referenceDate: dayjs.Dayjs): dayjs.Dayjs | null {
    // Supported formats: 24-hour (HH:mm) and 12-hour (hh:mm A)
    const supportedFormats = ['HH:mm', 'hh:mm A'];
    // Ensure locale is consistent if needed, although shouldn't matter for these formats
    const parsedTime = dayjs(timeStr.trim(), supportedFormats, true); // Use strict parsing

    if (!parsedTime.isValid()) {
        return null; // Parsing failed
    }

    // Combine the date part of referenceDate with the time part of parsedTime
    return referenceDate
        .hour(parsedTime.hour())
        .minute(parsedTime.minute())
        .second(0) // Reset seconds/milliseconds for consistency
        .millisecond(0);
}

/**
 * Parses a relative time adjustment string (e.g., "+15m", "-1h").
 * @param adjustmentStr The string to parse.
 * @returns An object { amount: number, unit: 'minute' | 'hour' } or null if invalid.
 */
export function parseRelativeTimeAdjustment(adjustmentStr: string): { amount: number; unit: 'minute' | 'hour' } | null {
    // Allow optional space after sign: "+ 15m"
    const match = adjustmentStr.trim().match(/^([+-])\s*(\d+)([mh])$/i); // case-insensitive unit
    if (!match) {
        return null;
    }

    const sign = match[1];
    const value = parseInt(match[2], 10);
    const unitChar = match[3].toLowerCase(); // Ensure lowercase for comparison

    if (isNaN(value) || value < 0) { // Value should be non-negative after sign
        return null;
    }

    const amount = sign === '+' ? value : -value; // Apply the sign
    const unit = unitChar === 'm' ? 'minute' : 'hour';

    return { amount, unit };
}

/**
 * Parses a duration string (e.g., "1h 30m", "45m", "2h", "90m") into seconds.
 * @param durationStr The duration string.
 * @returns Total duration in seconds, or null if parsing fails.
 */
export function parseDurationToSeconds(durationStr: string): number | null {
    if (!durationStr || typeof durationStr !== 'string') {
        return null;
    }

    const durationTrimmed = durationStr.trim().toLowerCase();
    if (!durationTrimmed) {
        return null;
    }

    // Regex to capture hours (h) and minutes (m), potentially in different orders or combined
    const hourRegex = /(\d+)\s*h/;
    const minRegex = /(\d+)\s*m/;

    const hourMatch = durationTrimmed.match(hourRegex);
    const minMatch = durationTrimmed.match(minRegex);

    let totalSeconds = 0;
    let foundUnit = false;

    if (hourMatch?.[1]) {
        const hours = parseInt(hourMatch[1], 10);
        if (!isNaN(hours)) {
            totalSeconds += hours * 60 * 60;
            foundUnit = true;
        } else { return null; } // Invalid number
    }

    if (minMatch?.[1]) {
        const minutes = parseInt(minMatch[1], 10);
        if (!isNaN(minutes)) {
            totalSeconds += minutes * 60;
            foundUnit = true;
        } else { return null; } // Invalid number
    }

    // Ensure the *entire* string roughly matches the pattern expected
    // This prevents things like "1h 30m foobar" from being partially parsed.
    // A simple check: remove matched parts and see if anything non-whitespace remains.
    const remaining = durationTrimmed
        .replace(hourRegex, '')
        .replace(minRegex, '')
        .trim();

    if (remaining !== '' || !foundUnit) {
        // If there's leftover text that isn't hours/minutes OR no units were found
        return null;
    }


    return totalSeconds > 0 ? totalSeconds : null; // Return null if duration isn't positive
}


/**
 * Calculates the duration between two ISO 8601 timestamps in seconds.
 */
export function calculateDuration(startTime: string, endTime: string): number {
    const start = dayjs(startTime);
    const end = dayjs(endTime);
    return end.diff(start, 'second');
}