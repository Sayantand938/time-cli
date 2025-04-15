import Database, { Database as DB } from 'better-sqlite3'; // Import Database constructor and type
import path from 'path';
import fs from 'fs/promises';
import envPaths from 'env-paths';

const paths = envPaths('time-cli', { suffix: '' });
const dbPath = path.join(paths.data, 'timetracker.db');

// db instance is now synchronous once initialized
let db: DB | null = null;

export async function initDb(): Promise<void> { // Return void, as the db instance is set synchronously
    if (db) {
        return; // Already initialized
    }

    try {
        // Ensure the directory exists (this part remains async)
        await fs.mkdir(paths.data, { recursive: true });

        // Open the database (synchronous)
        // If you need detailed DB logging during development, uncomment the verbose option
        const newDb = new Database(dbPath, { /* verbose: console.log */ });

        // Use synchronous exec for schema creation
        newDb.exec(`
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                start_time TEXT NOT NULL,
                end_time TEXT,
                duration INTEGER
            );
        `);

        newDb.exec(`
            CREATE TABLE IF NOT EXISTS status (
                key TEXT PRIMARY KEY CHECK (key = 'current_session'),
                session_id TEXT NOT NULL,
                start_time TEXT NOT NULL
            );
        `);

        // Set the global db instance
        db = newDb;
        // console.log(`Database initialized at: ${dbPath}`); // User-facing message removed

        // Ensure WAL mode is enabled for better concurrency handling if needed,
        // though less critical for a single-user CLI. Good practice anyway.
        db.pragma('journal_mode = WAL');

        // Close the database connection gracefully on exit
        process.on('exit', () => {
            if (db && db.open) {
                db.close();
                // console.log('Database connection closed.'); // User-facing message removed
            }
        });
        // Handle SIGINT (Ctrl+C)
         process.on('SIGINT', () => {
             if (db && db.open) {
                 db.close();
                 // console.log('\nDatabase connection closed due to SIGINT.'); // User-facing message removed
             }
             process.exit(0); // Ensure the process exits cleanly after closing DB on Ctrl+C
         });


    } catch (error) {
        // Keep critical error logging
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

// getDb is now synchronous
export function getDb(): DB {
    if (!db) {
        // This should ideally not happen if initDb is called correctly at startup
        // Keep this error as it indicates a programming error
        throw new Error("Database not initialized. Call initDb first and ensure it completes.");
    }
    return db;
}

// Interfaces remain the same as they describe data structure
export interface LogEntry {
    id: string;
    start_time: string;
    end_time: string | null;
    duration: number | null; // in seconds
}

export interface StatusEntry {
    key: 'current_session';
    session_id: string;
    start_time: string;
}