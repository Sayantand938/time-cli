# src/time_cli_pkg/database.py

import sqlite3
import uuid
from datetime import datetime, date

from . import config

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    config.DB_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database and creates the 'entries' table if it doesn't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_active_entry():
    """Retrieves the currently active (un-stopped) time entry."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM entries WHERE end_time IS NULL")
    active_entry = cursor.fetchone()
    conn.close()
    return active_entry

def add_start_entry():
    """Adds a new time entry and returns the start time."""
    conn = get_db_connection()
    cursor = conn.cursor()
    entry_id = str(uuid.uuid4())
    start_time = datetime.now()
    cursor.execute("INSERT INTO entries (id, start_time) VALUES (?, ?)", (entry_id, start_time))
    conn.commit()
    conn.close()
    return start_time

def update_end_entry(entry_id, end_time):
    """Updates an existing entry with the provided end time."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE entries SET end_time = ? WHERE id = ?", (end_time, entry_id))
    conn.commit()
    conn.close()

def get_logs(filter_date=None, show_all=False):
    """Retrieves log entries."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if show_all:
        cursor.execute("SELECT * FROM entries ORDER BY start_time DESC")
    elif filter_date:
        query_date = datetime.strptime(filter_date, '%Y-%m-%d').date()
        cursor.execute("SELECT * FROM entries WHERE date(start_time) = ? ORDER BY start_time DESC", (query_date,))
    else:
        today = datetime.now().date()
        cursor.execute("SELECT * FROM entries WHERE date(start_time) = ? ORDER BY start_time DESC", (today,))
    logs = cursor.fetchall()
    conn.close()
    return logs

def add_manual_entry(start_time, end_time):
    """Adds a complete, historical time entry."""
    conn = get_db_connection()
    cursor = conn.cursor()
    entry_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO entries (id, start_time, end_time) VALUES (?, ?, ?)", (entry_id, start_time, end_time))
    conn.commit()
    conn.close()
    return entry_id

def bulk_insert_entries(entries: list[dict]):
    """Inserts multiple entries into the database in a single transaction."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Prepare data for executemany, which expects a list of tuples
    data_to_insert = [
        (entry['id'], entry['start_time'], entry.get('end_time'))
        for entry in entries
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO entries (id, start_time, end_time) VALUES (?, ?, ?)",
        data_to_insert
    )
    conn.commit()
    conn.close()

def find_entry_by_partial_id(partial_id: str):
    """Finds log entries where the ID starts with the given partial ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM entries WHERE id LIKE ?", (f"{partial_id}%",))
    entries = cursor.fetchall()
    conn.close()
    return entries

def update_entry(entry_id: str, new_start_time: datetime, new_end_time: datetime):
    """Updates the start and end times for a specific entry."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE entries SET start_time = ?, end_time = ? WHERE id = ?", (new_start_time, new_end_time, entry_id))
    conn.commit()
    conn.close()

def delete_database():
    """Deletes the database file if it exists. Returns True if deleted, False otherwise."""
    if config.DB_PATH.exists():
        config.DB_PATH.unlink()
        return True
    return False

def get_total_duration_for_date(target_date: date) -> int:
    """
    Calculates the total duration in seconds for all completed entries on a given date.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    # SUM the difference in seconds between end_time and start_time
    cursor.execute(
        """
        SELECT SUM(strftime('%s', end_time) - strftime('%s', start_time))
        FROM entries
        WHERE date(start_time) = ? AND end_time IS NOT NULL
        """,
        (target_date,)
    )
    total_seconds = cursor.fetchone()[0]
    conn.close()
    return total_seconds or 0 # Return 0 if the result is None