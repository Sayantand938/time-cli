import { Command } from 'commander';
import { getDb, StatusEntry } from '../lib/db'; // getDb is now sync
import { generateUUID, getCurrentISOTimestamp, formatTime } from '../lib/utils';

export function registerStartCommand(program: Command) {
    program
        .command('start')
        .description('Starts a new study session.')
        .action(() => { // action can be synchronous now
            try {
                const db = getDb(); // Synchronous call

                // Prepare statements for reuse
                const checkStatusStmt = db.prepare<[], StatusEntry>("SELECT * FROM status WHERE key = 'current_session'");
                const insertStatusStmt = db.prepare("INSERT INTO status (key, session_id, start_time) VALUES (?, ?, ?)");
                const insertLogStmt = db.prepare("INSERT INTO logs (id, start_time) VALUES (?, ?)");


                // Check if a session is already running
                const currentSession = checkStatusStmt.get(); // Synchronous call

                if (currentSession) {
                    console.error(`Error: A session is already running (started at ${formatTime(currentSession.start_time)}).`);
                    console.error('Use "time-cli stop" to end the current session first.');
                    process.exit(1);
                }

                // Start a new session
                const newSessionId = generateUUID();
                const startTime = getCurrentISOTimestamp();

                // Use a transaction for atomicity
                db.transaction(() => {
                    insertStatusStmt.run('current_session', newSessionId, startTime);
                    insertLogStmt.run(newSessionId, startTime);
                })(); // Immediately execute the transaction

                console.log(`Session started at ${formatTime(startTime)}.`);

            } catch (error) {
                console.error('Failed to start session:', error);
                process.exit(1);
            }
        });
}