// D:/Coding/time-cli/src/db.ts

import Database, { Database as DBDriver } from 'better-sqlite3';
import * as fs from 'fs';
import { getDatabasePath, getDataDirectory } from './utils';

// Global database connection instance
let db: DBDriver | null = null;

/**
 * Initializes and returns the database connection.
 * It ensures the data directory and database file exist, and the tables are created.
 * @returns The better-sqlite3 Database instance.
 */
export function initDB(): DBDriver {
  if (db) {
    return db;
  }

  const dataDir = getDataDirectory();
  const dbPath = getDatabasePath();

  // 1. Ensure the directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  }

  // 2. Open the database connection
  try {
    // Setting verbose to true can help with debugging, but we keep it minimal for production.
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // Recommended for better concurrency

    // 3. Create tables if they don't exist
    createTables(db);
    
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    // FIX: Removed process.exit(1) to allow the calling code (time-cli.ts) to handle the exit
    throw error; 
  }
}

/**
 * Creates the necessary tables (`days` and `slots`) if they do not exist.
 * @param database - The better-sqlite3 Database instance.
 */
function createTables(database: DBDriver): void {
  // days table: tracks dates that have been initialized
  const createDaysTable = `
    CREATE TABLE IF NOT EXISTS days (
      date TEXT PRIMARY KEY NOT NULL
    );
  `;

  // slots table: tracks the completion status of each slot for a given date
  const createSlotsTable = `
    CREATE TABLE IF NOT EXISTS slots (
      date TEXT NOT NULL,
      slot INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, slot),
      FOREIGN KEY (date) REFERENCES days(date)
    );
  `;

  database.exec(createDaysTable);
  database.exec(createSlotsTable);
}

/**
 * Closes the database connection.
 */
export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}