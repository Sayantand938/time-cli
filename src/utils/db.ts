// src/utils/db.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import envPaths from 'env-paths';
import { TIME_SLOTS_CONFIG, getSlotConfigByStoreValue, TimeSlot, SLOT_TARGET_MINUTES } from './constants.js';

// ... (ensureDbDirExists, getDb, initDb, getSlotDurationForDate, logStudyAndManageBank, redeemTimeFromBank, getTimeBankBalance, closeDb - keep these as they are)
const paths = envPaths('time-cli', { suffix: '' });
const dbDir = paths.data;
const dbPath = path.join(dbDir, 'study_log.db');

let dbInstance: Database.Database | null = null;

function ensureDbDirExists(): void {
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create database directory at ${dbDir}:`, error);
      throw new Error(`Failed to create database directory at ${dbDir}. Please check permissions for this location.`);
    }
  }
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    ensureDbDirExists();
    try {
      dbInstance = new Database(dbPath);
      dbInstance.pragma('journal_mode = WAL');
    } catch (error) {
        console.error(`Failed to open or create database at ${dbPath}:`, error);
        throw new Error(`Failed to initialize the database. Check console for details or permissions for ${dbDir}.`);
    }
  }
  return dbInstance;
}

export function initDb(): void {
  try {
    const db = getDb();
    const slotColumnDefinitions = TIME_SLOTS_CONFIG
      .map(slot => `${slot.dbColumn} INTEGER DEFAULT 0`)
      .join(',\n          ');

    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_study_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_date TEXT NOT NULL UNIQUE, -- Ensures only one row per date
        ${slotColumnDefinitions}
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS time_bank_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        minutes INTEGER NOT NULL,
        source_session_date TEXT,
        source_slot_key TEXT,     -- This should store slotConfig.storeValue
        description TEXT
      );
    `);

  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw new Error('Failed to initialize database schema. See console for details.');
  }
}

export function getSlotDurationForDate(sessionDate: string, slotStoreValue: string): number | null {
  const db = getDb();
  const slotConfig = getSlotConfigByStoreValue(slotStoreValue);

  if (!slotConfig) {
    return null; 
  }
  const columnName = slotConfig.dbColumn;

  try {
    const dayLogExists = db.prepare('SELECT 1 FROM daily_study_logs WHERE session_date = ?').get(sessionDate);
    if (!dayLogExists) {
      return 0; 
    }

    const stmt = db.prepare(`SELECT ${columnName} FROM daily_study_logs WHERE session_date = ?`);
    const result = stmt.get(sessionDate) as Record<string, number> | undefined;

    if (result && typeof result[columnName] === 'number') {
      return result[columnName];
    }
    return 0;
  } catch (error) {
    console.error(`Error fetching duration for slot ${columnName} on ${sessionDate}:`, error);
    return null; 
  }
}


export function logStudyAndManageBank(
  sessionDate: string,
  slotStoreValue: string, 
  minutesToLogForSlot: number,
  bankAction?: { type: 'deposit', minutes: number }
): void {
  const db = getDb();
  const transaction = db.transaction(() => {
    const slotConfig = getSlotConfigByStoreValue(slotStoreValue);
    if (!slotConfig) {
      throw new Error(`Invalid slot storeValue provided for recording: ${slotStoreValue}`);
    }
    const columnName = slotConfig.dbColumn;

    const insertDayStmt = db.prepare(`
      INSERT INTO daily_study_logs (session_date)
      VALUES (?)
      ON CONFLICT(session_date) DO NOTHING;
    `);
    insertDayStmt.run(sessionDate);

    const updateSlotStmt = db.prepare(`
      UPDATE daily_study_logs
      SET ${columnName} = ?
      WHERE session_date = ?;
    `);
    updateSlotStmt.run(minutesToLogForSlot, sessionDate);

    if (bankAction && bankAction.type === 'deposit' && bankAction.minutes > 0) {
      const bankStmt = db.prepare(`
        INSERT INTO time_bank_transactions (type, minutes, source_session_date, source_slot_key, description)
        VALUES ('deposit', ?, ?, ?, ?);
      `);
      bankStmt.run(
        bankAction.minutes,
        sessionDate,
        slotStoreValue, 
        `Excess from slot ${slotConfig.displayName} on ${sessionDate}`
      );
    }
  });

  try {
    transaction();
  } catch (error) {
    console.error('Failed to record study session and manage bank in database:', error);
    throw new Error('Could not save study session or update bank. See console for details.');
  }
}

export function redeemTimeFromBank(
  sessionDate: string,
  slotConfig: TimeSlot, 
  minutesToAttemptRedeem: number
): { success: boolean; message: string; actualRedeemed?: number, newSlotValue?: number } {
  const db = getDb();
  const transactionResult = db.transaction(() => {
    const currentBankBalance = getTimeBankBalance(); 
    if (currentBankBalance <= 0) {
      return { success: false, message: "Time bank is empty. Cannot redeem." };
    }

    const currentSlotMinutes = getSlotDurationForDate(sessionDate, slotConfig.storeValue);
    if (currentSlotMinutes === null) {
      return { success: false, message: `Error fetching current minutes for ${slotConfig.displayName} on ${sessionDate}.` };
    }
    if (currentSlotMinutes >= SLOT_TARGET_MINUTES) {
      return { success: false, message: `Slot ${slotConfig.displayName} on ${sessionDate} is already at or above target (${currentSlotMinutes}m / ${SLOT_TARGET_MINUTES}m). No redemption needed.` };
    }

    const maxCanAddToSlot = SLOT_TARGET_MINUTES - currentSlotMinutes;
    const actualMinutesToRedeem = Math.min(minutesToAttemptRedeem, maxCanAddToSlot, currentBankBalance);

    if (actualMinutesToRedeem <= 0) {
      let reason = "Cannot redeem 0 or negative minutes.";
      if (currentBankBalance < minutesToAttemptRedeem && currentBankBalance < maxCanAddToSlot) {
        reason = `Not enough in bank (${currentBankBalance}m) to make a meaningful redemption for this slot (needs ${maxCanAddToSlot}m, tried ${minutesToAttemptRedeem}m).`;
      } else if (maxCanAddToSlot <=0) {
         reason = `Slot is already full or does not need topping up with the requested amount.`;
      }
      return { success: false, message: reason };
    }

    const newSlotValue = currentSlotMinutes + actualMinutesToRedeem;

    const insertDayStmt = db.prepare(`INSERT INTO daily_study_logs (session_date) VALUES (?) ON CONFLICT(session_date) DO NOTHING;`);
    insertDayStmt.run(sessionDate);
    
    const updateSlotStmt = db.prepare(`
      UPDATE daily_study_logs
      SET ${slotConfig.dbColumn} = ?
      WHERE session_date = ?;
    `);
    updateSlotStmt.run(newSlotValue, sessionDate);

    const withdrawalStmt = db.prepare(`
      INSERT INTO time_bank_transactions (type, minutes, source_session_date, source_slot_key, description)
      VALUES ('withdrawal', ?, ?, ?, ?);
    `);
    withdrawalStmt.run(
      actualMinutesToRedeem,
      sessionDate,
      slotConfig.storeValue, 
      `Redeemed ${actualMinutesToRedeem}m for slot ${slotConfig.displayName} on ${sessionDate}`
    );

    return {
      success: true,
      message: `Successfully redeemed ${actualMinutesToRedeem}m.`,
      actualRedeemed: actualMinutesToRedeem,
      newSlotValue: newSlotValue
    };
  }); 

  try {
    return transactionResult(); 
  } catch (error) {
    console.error('Database error during redemption transaction:', error);
    return { success: false, message: "A database error occurred during the redemption process. Check console for details." };
  }
}


export function getTimeBankBalance(): number {
  const db = getDb();
  try {
    const stmt = db.prepare(`
      SELECT SUM(CASE type WHEN 'deposit' THEN minutes ELSE -minutes END) as balance
      FROM time_bank_transactions;
    `);
    const result = stmt.get() as { balance: number | null };
    return result?.balance ?? 0;
  } catch (error) {
    console.error('Error fetching time bank balance:', error);
    return 0; 
  }
}

// NEW FUNCTION for fetching transaction history
export interface BankTransaction {
  id: number;
  transaction_timestamp: string;
  type: 'deposit' | 'withdrawal';
  minutes: number;
  source_session_date: string | null;
  source_slot_key: string | null;
  description: string | null;
}

export function getBankTransactionHistory(limit: number = 20, offset: number = 0): BankTransaction[] {
  const db = getDb();
  try {
    const stmt = db.prepare(`
      SELECT id, transaction_timestamp, type, minutes, source_session_date, source_slot_key, description
      FROM time_bank_transactions
      ORDER BY transaction_timestamp DESC, id DESC
      LIMIT ? OFFSET ?;
    `);
    // Ensure limit and offset are numbers, default if not.
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
    const effectiveOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

    return stmt.all(effectiveLimit, effectiveOffset) as BankTransaction[];
  } catch (error) {
    console.error('Error fetching time bank transaction history:', error);
    return []; // Return empty array on error
  }
}


export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}