import { Command } from 'commander';
import { getDb, StatusEntry } from '../lib/db'; // getDb is sync
import { shortenUUID } from '../lib/utils';

export function registerDeleteCommand(program: Command) {
    program
        .command('delete <id>')
        .description('Deletes a session by its short ID (first 6 chars).')
        .action((id: string) => { // action can be sync
            if (!id || id.length !== 6) {
                 console.error('Error: Please provide the short ID (first 6 characters) of the session to delete.');
                 process.exit(1);
            }

            try {
                const db = getDb(); // Sync

                // Prepare statements
                const findLogStmt = db.prepare<{ id_pattern: string }, { id: string }>("SELECT id FROM logs WHERE id LIKE :id_pattern");
                const checkStatusStmt = db.prepare<[string], { session_id: string }>("SELECT session_id FROM status WHERE key = 'current_session' AND session_id = ?");
                const deleteLogStmt = db.prepare("DELETE FROM logs WHERE id = ?");


                // Find the full ID based on the short ID
                const matchingLogs = findLogStmt.all({ id_pattern: `${id}%` }); // Sync

                if (matchingLogs.length === 0) {
                    console.error(`Error: No session found with ID starting with "${id}".`);
                    process.exit(1);
                }

                if (matchingLogs.length > 1) {
                    console.error(`Error: Multiple sessions found starting with "${id}". Deletion aborted for safety.`);
                    console.error('Matching full IDs:');
                    matchingLogs.forEach(log => console.error(`  - ${log.id}`));
                    process.exit(1);
                }

                const fullIdToDelete = matchingLogs[0].id;

                 // Check if the session to be deleted is the currently active one
                const currentSession = checkStatusStmt.get(fullIdToDelete); // Sync

                if (currentSession) {
                     console.error(`Error: Cannot delete the currently active session (${shortenUUID(fullIdToDelete)}).`);
                     console.error('Stop the session first using "time-cli stop".');
                     process.exit(1);
                }

                // Perform the deletion
                const info = deleteLogStmt.run(fullIdToDelete); // Sync

                if (info.changes === 0) {
                    console.error(`Error: Session with full ID "${fullIdToDelete}" could not be deleted (might have been deleted already).`);
                    process.exit(1);
                }

                console.log(`Session with ID ${shortenUUID(fullIdToDelete)} (${id}...) deleted.`);

            } catch (error) {
                console.error('Failed to delete session:', error);
                process.exit(1);
            }
        });
}