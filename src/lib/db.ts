// import os from 'os';
// import fs from 'fs';
// import path from 'path';
// import Database, { Statement } from 'better-sqlite3';
// import { v4 as uuidv4 } from 'uuid';
// import chalk from 'chalk';

// // Define the structure of a session row
// export interface Session {
//     id: string;
//     start_time: number; // Unix timestamp in seconds
//     end_time: number | null; // Unix timestamp in seconds or null if active
// }

// // --- Database Path Setup (Platform Aware) ---
// function getAppDataPath(): string {
//     let basePath: string | undefined;

//     if (process.platform === 'win32') {
//         basePath = process.env.LOCALAPPDATA;
//     } else {
//         basePath = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
//     }

//     if (!basePath) {
//         basePath = path.join(os.homedir(), '.time-cli-data');
//         console.warn(`Could not determine standard app data directory, using fallback: ${basePath}`);
//     }

//     const appDataDir = path.join(basePath, 'time-cli');

//     if (!fs.existsSync(appDataDir)) {
//         try {
//             fs.mkdirSync(appDataDir, { recursive: true });
//         } catch (error) {
//              console.error(`Error creating application data directory: ${appDataDir}`, error);
//              process.exit(1);
//         }
//     }
//     return appDataDir;
// }

// const appDataDirectory = getAppDataPath();
// const dbPath = path.join(appDataDirectory, 'time_data.db');

// // --- Database Initialization & Connection ---
// let dbInstance: Database.Database | null = null;

// function initializeDatabase(): Database.Database {
//     if (dbInstance) {
//         return dbInstance;
//     }
//     try {
//         const db = new Database(dbPath);
//         db.pragma('journal_mode = WAL');
//         db.exec(`
//             CREATE TABLE IF NOT EXISTS sessions (
//                 id TEXT PRIMARY KEY,
//                 start_time INTEGER NOT NULL,
//                 end_time INTEGER DEFAULT NULL
//             );
//             CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active
//                 ON sessions (end_time) WHERE end_time IS NULL;
//             CREATE INDEX IF NOT EXISTS idx_sessions_start_time
//                 ON sessions (start_time);
//         `);
//         dbInstance = db;
//         // console.log("Database initialized successfully."); // <-- Line Removed/Commented
//         return db;
//     } catch (error) {
//         console.error('Database initialization error:', error);
//         process.exit(1);
//     }
// }

// export const db = initializeDatabase();

// // --- Database Operations ---

// // Prepared Statements Cache
// let findActiveSessionStmt: Statement | null = null;
// let startSessionStmt: Statement | null = null;
// let stopSessionStmt: Statement | null = null;
// let getAllSessionsStmt: Statement | null = null;
// let addManualSessionStmt: Statement | null = null;
// let findOverlappingSessionsStmt: Statement | null = null;
// let deleteSessionByShortIdStmt: Statement | null = null;

// export function findActiveSession(): Session | undefined {
//     if (!findActiveSessionStmt) {
//         findActiveSessionStmt = db.prepare('SELECT id, start_time FROM sessions WHERE end_time IS NULL');
//     }
//     try {
//         return findActiveSessionStmt.get() as Session | undefined;
//     } catch (error) {
//         console.error("Error finding active session:", error);
//         return undefined;
//     }
// }

// export function startSession(): string | null {
//     if (findActiveSession()) {
//         return null;
//     }
//     if (!startSessionStmt) {
//         startSessionStmt = db.prepare('INSERT INTO sessions (id, start_time, end_time) VALUES (?, ?, NULL)');
//     }
//     const id = uuidv4();
//     const startTime = Math.floor(Date.now() / 1000);
//     try {
//         const info = startSessionStmt.run(id, startTime);
//         return info.changes > 0 ? id : null;
//     } catch (error: any) {
//         console.error("Error starting session:", error);
//         return null;
//     }
// }

// export function stopSession(id: string): boolean {
//     if (!stopSessionStmt) {
//         stopSessionStmt = db.prepare('UPDATE sessions SET end_time = ? WHERE id = ? AND end_time IS NULL');
//     }
//     const endTime = Math.floor(Date.now() / 1000);
//     try {
//         const info = stopSessionStmt.run(endTime, id);
//         return info.changes > 0;
//     } catch (error) {
//         console.error("Error stopping session:", error);
//         return false;
//     }
// }

// export function getAllSessions(): Session[] {
//     if (!getAllSessionsStmt) {
//         getAllSessionsStmt = db.prepare('SELECT id, start_time, end_time FROM sessions ORDER BY start_time DESC');
//     }
//     try {
//         return getAllSessionsStmt.all() as Session[];
//     } catch (error) {
//         console.error("Error fetching sessions:", error);
//         return [];
//     }
// }

// export function findOverlappingSessions(startTimestamp: number, endTimestamp: number): Session[] {
//     if (!findOverlappingSessionsStmt) {
//         findOverlappingSessionsStmt = db.prepare(`
//             SELECT id, start_time, end_time
//             FROM sessions
//             WHERE
//                 start_time < ?
//                 AND (end_time > ? OR end_time IS NULL)
//          `);
//     }
//     try {
//         return findOverlappingSessionsStmt.all(endTimestamp, startTimestamp) as Session[];
//     } catch (error) {
//         console.error("Error finding overlapping sessions:", error);
//         return [];
//     }
// }

// export function addManualSession(startTimestamp: number, endTimestamp: number): string | null {
//      if (startTimestamp >= endTimestamp) {
//         console.error(chalk.red("Error: Start time must be strictly before end time."));
//         return null;
//     }
//     const overlaps = findOverlappingSessions(startTimestamp, endTimestamp);
//     if (overlaps.length > 0) {
//         console.error(chalk.red('Error: The specified time range overlaps with existing session(s):'));
//         overlaps.forEach(ov => {
//             console.error(chalk.yellow(`  - ID: ${ov.id.substring(0,8)}, Start: ${formatTimestampLocal(ov.start_time)}, End: ${formatTimestampLocal(ov.end_time)}`));
//         });
//         return null;
//     }
//     if (!addManualSessionStmt) {
//         addManualSessionStmt = db.prepare('INSERT INTO sessions (id, start_time, end_time) VALUES (?, ?, ?)');
//     }
//     const id = uuidv4();
//     try {
//         const info = addManualSessionStmt.run(id, startTimestamp, endTimestamp);
//         return info.changes > 0 ? id : null;
//     } catch (error: any) {
//         if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
//              console.error(chalk.red('Error: Unique constraint failed. Cannot add session potentially conflicting with an active one.'));
//         } else {
//             console.error("Error adding manual session:", error);
//         }
//         return null;
//     }
// }


// export function deleteSessionByShortId(shortId: string): number {
//     if (!deleteSessionByShortIdStmt) {
//         deleteSessionByShortIdStmt = db.prepare('DELETE FROM sessions WHERE id LIKE ?');
//     }
//     try {
//         const info = deleteSessionByShortIdStmt.run(`${shortId}%`);
//         return info.changes;
//     } catch (error) {
//         console.error(`Error deleting session(s) with short ID prefix ${shortId}:`, error);
//         return -1; // Indicate an error occurred during deletion
//     }
// }


// // --- Helper Function (Local to db.ts for error messages) ---
// function formatTimestampLocal(timestampSeconds: number | null): string {
//     if (timestampSeconds === null) {
//         return chalk.yellow('Active');
//     }
//     try {
//         const date = new Date(timestampSeconds * 1000);
//         return date.toLocaleString();
//     } catch (e) {
//         return chalk.red('Invalid Date');
//     }
// }


// // --- Graceful Shutdown ---
// process.on('exit', () => {
//     if (dbInstance && dbInstance.open) {
//         dbInstance.close();
//         // console.log('Database connection closed.');
//     }
// });
// process.on('SIGINT', () => {
//     process.exit(0);
// });


import os from 'os';
import fs from 'fs';
import path from 'path';
import Database, { Statement } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

export interface Session {
    id: string;
    start_time: number;
    end_time: number | null;
}

function getAppDataPath(): string {
    let basePath: string | undefined;
    if (process.platform === 'win32') basePath = process.env.LOCALAPPDATA;
    else basePath = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    if (!basePath) basePath = path.join(os.homedir(), '.time-cli-data');
    const appDataDir = path.join(basePath, 'time-cli');
    if (!fs.existsSync(appDataDir)) {
        try { fs.mkdirSync(appDataDir, { recursive: true }); }
        catch (error) { console.error(`Error creating app data dir: ${appDataDir}`, error); process.exit(1); }
    }
    return appDataDir;
}

const appDataDirectory = getAppDataPath();
const dbPath = path.join(appDataDirectory, 'time_data.db');
let dbInstance: Database.Database | null = null;

function initializeDatabase(): Database.Database {
    if (dbInstance) return dbInstance;
    try {
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, start_time INTEGER NOT NULL, end_time INTEGER DEFAULT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active ON sessions (end_time) WHERE end_time IS NULL;
            CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions (start_time);
        `);
        dbInstance = db;
        return db;
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
}

export const db = initializeDatabase();

let findActiveSessionStmt: Statement | null = null;
let startSessionStmt: Statement | null = null;
let stopSessionStmt: Statement | null = null;
let getAllSessionsStmt: Statement | null = null;
let addManualSessionStmt: Statement | null = null;
let findOverlappingSessionsStmt: Statement | null = null;
let deleteSessionByShortIdStmt: Statement | null = null;
let findSessionsByShortIdStmt: Statement | null = null;
let updateSessionStmt: Statement | null = null;
let findOverlappingSessionsForEditStmt: Statement | null = null;

export function findActiveSession(): Session | undefined {
    if (!findActiveSessionStmt) findActiveSessionStmt = db.prepare('SELECT id, start_time FROM sessions WHERE end_time IS NULL');
    try { return findActiveSessionStmt.get() as Session | undefined; }
    catch (error) { console.error("Error finding active session:", error); return undefined; }
}

export function startSession(): string | null {
    if (findActiveSession()) return null;
    if (!startSessionStmt) startSessionStmt = db.prepare('INSERT INTO sessions (id, start_time, end_time) VALUES (?, ?, NULL)');
    const id = uuidv4();
    const startTime = Math.floor(Date.now() / 1000);
    try {
        const info = startSessionStmt.run(id, startTime);
        return info.changes > 0 ? id : null;
    } catch (error: any) { console.error("Error starting session:", error); return null; }
}

export function stopSession(id: string): boolean {
    if (!stopSessionStmt) stopSessionStmt = db.prepare('UPDATE sessions SET end_time = ? WHERE id = ? AND end_time IS NULL');
    const endTime = Math.floor(Date.now() / 1000);
    try {
        const info = stopSessionStmt.run(endTime, id);
        return info.changes > 0;
    } catch (error) { console.error("Error stopping session:", error); return false; }
}

export function getAllSessions(): Session[] {
    if (!getAllSessionsStmt) getAllSessionsStmt = db.prepare('SELECT id, start_time, end_time FROM sessions ORDER BY start_time DESC');
    try { return getAllSessionsStmt.all() as Session[]; }
    catch (error) { console.error("Error fetching sessions:", error); return []; }
}

export function findSessionsByShortId(shortId: string): Session[] {
    if (!findSessionsByShortIdStmt) findSessionsByShortIdStmt = db.prepare('SELECT id, start_time, end_time FROM sessions WHERE id LIKE ?');
    try { return findSessionsByShortIdStmt.all(`${shortId}%`) as Session[]; }
    catch (error) { console.error(`Error finding sessions with short ID prefix ${shortId}:`, error); return []; }
}

export function findOverlappingSessions(startTimestamp: number, endTimestamp: number): Session[] {
    if (!findOverlappingSessionsStmt) findOverlappingSessionsStmt = db.prepare(`
        SELECT id, start_time, end_time FROM sessions WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)`);
    try { return findOverlappingSessionsStmt.all(endTimestamp, startTimestamp) as Session[]; }
    catch (error) { console.error("Error finding overlapping sessions:", error); return []; }
}

export function findOverlappingSessionsForEdit(startTimestamp: number, endTimestamp: number | null, excludeSessionId: string): Session[] {
    if (endTimestamp === null) {
         const activeOverlapStmt = db.prepare(`SELECT id, start_time, end_time FROM sessions WHERE end_time IS NULL AND id != ?`);
         const completedOverlapStmt = db.prepare(`SELECT id, start_time, end_time FROM sessions WHERE end_time IS NOT NULL AND end_time > ? AND id != ?`);
        try {
            const activeOverlaps = activeOverlapStmt.all(excludeSessionId) as Session[];
            const completedOverlaps = completedOverlapStmt.all(startTimestamp, excludeSessionId) as Session[];
            return [...activeOverlaps, ...completedOverlaps];
        } catch (error) { console.error("Error finding overlaps for edit (active):", error); return []; }
    } else {
         if (!findOverlappingSessionsForEditStmt) findOverlappingSessionsForEditStmt = db.prepare(`
             SELECT id, start_time, end_time FROM sessions WHERE id != ? AND start_time < ? AND (end_time > ? OR end_time IS NULL)`);
        try { return findOverlappingSessionsForEditStmt.all(excludeSessionId, endTimestamp, startTimestamp) as Session[]; }
        catch (error) { console.error("Error finding overlaps for edit:", error); return []; }
    }
}

export function addManualSession(startTimestamp: number, endTimestamp: number): string | null {
     if (startTimestamp >= endTimestamp) { console.error(chalk.red("Start time must be before end time.")); return null; }
    const overlaps = findOverlappingSessions(startTimestamp, endTimestamp);
    if (overlaps.length > 0) {
        console.error(chalk.red('Overlap detected:'));
        overlaps.forEach(ov => console.error(chalk.yellow(`  - ID: ${ov.id.substring(0,8)}, Start: ${formatTimestampLocal(ov.start_time)}, End: ${formatTimestampLocal(ov.end_time)}`)));
        return null;
    }
    if (!addManualSessionStmt) addManualSessionStmt = db.prepare('INSERT INTO sessions (id, start_time, end_time) VALUES (?, ?, ?)');
    const id = uuidv4();
    try {
        const info = addManualSessionStmt.run(id, startTimestamp, endTimestamp);
        return info.changes > 0 ? id : null;
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') console.error(chalk.red('Constraint failed (active session conflict?).'));
        else console.error("Error adding manual session:", error);
        return null;
    }
}

export function updateSession(id: string, newStartTime: number, newEndTime: number | null): boolean {
     if (!updateSessionStmt) updateSessionStmt = db.prepare('UPDATE sessions SET start_time = ?, end_time = ? WHERE id = ?');
    try {
        const endTimeValue = newEndTime === null ? null : newEndTime;
        const info = updateSessionStmt.run(newStartTime, endTimeValue, id);
        return info.changes > 0;
    } catch (error: any) {
         if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && newEndTime === null) console.error(chalk.red('Cannot make session active; another is already active.'));
         else console.error(`Error updating session ${id}:`, error);
        return false;
    }
}

export function deleteSessionByShortId(shortId: string): number {
    if (!deleteSessionByShortIdStmt) deleteSessionByShortIdStmt = db.prepare('DELETE FROM sessions WHERE id LIKE ?');
    try {
        const info = deleteSessionByShortIdStmt.run(`${shortId}%`);
        return info.changes;
    } catch (error) { console.error(`Error deleting session(s) with prefix ${shortId}:`, error); return -1; }
}

function formatTimestampLocal(timestampSeconds: number | null): string {
    if (timestampSeconds === null) return chalk.yellow('Active');
    try { return new Date(timestampSeconds * 1000).toLocaleString(); }
    catch (e) { return chalk.red('Invalid Date'); }
}

process.on('exit', () => { if (dbInstance && dbInstance.open) dbInstance.close(); });
process.on('SIGINT', () => { process.exit(0); });