import { Command } from 'commander';
import { getDb, StatusEntry } from '../lib/db'; // getDb is now sync
import { getCurrentISOTimestamp, formatTime, calculateDuration, formatDuration } from '../lib/utils';

export function registerStopCommand(program: Command) {
    program
        .command('stop')
        .description('Stops the current study session.')
        .action(() => { // action can be synchronous
            try {
                const db = getDb(); // Synchronous call

                // Prepare statements
                const getStatusStmt = db.prepare<[], StatusEntry>("SELECT * FROM status WHERE key = 'current_session'");
                const updateLogStmt = db.prepare("UPDATE logs SET end_time = ?, duration = ? WHERE id = ?");
                const deleteStatusStmt = db.prepare("DELETE FROM status WHERE key = 'current_session'");


                // Check if a session is running
                const currentSession = getStatusStmt.get(); // Synchronous call

                if (!currentSession) {
                    console.error('Error: No active session is running.');
                    console.error('Use "time-cli start" to begin a new session.');
                    process.exit(1);
                }

                const endTime = getCurrentISOTimestamp();
                const startTime = currentSession.start_time;
                const sessionId = currentSession.session_id;
                const durationSeconds = calculateDuration(startTime, endTime);

                 // Use a transaction
                db.transaction(() => {
                    // Update the log entry
                    const info = updateLogStmt.run(endTime, durationSeconds, sessionId);
                     if (info.changes === 0) {
                         // This might happen if the log entry was somehow deleted externally
                         console.warn(`Warning: Could not find log entry with ID ${sessionId} to update.`);
                     }

                    // Remove the session from status
                    deleteStatusStmt.run();
                })(); // Immediately execute

                console.log(`Session stopped at ${formatTime(endTime)}.`);
                console.log(`Duration: ${formatDuration(durationSeconds)}`);

            } catch (error) {
                console.error('Failed to stop session:', error);
                process.exit(1);
            }
        });
}