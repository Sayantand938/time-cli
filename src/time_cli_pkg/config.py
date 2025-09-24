# src/time_cli_pkg/config.py

"""
Configuration settings for the time-cli application.
"""

from pathlib import Path
from datetime import timedelta, time

# --- Database Configuration ---
DB_DIR = Path.home() / ".time-cli"
DB_PATH = DB_DIR / "timetracker.db"

# --- Formatting Constants ---
TIME_FORMAT = "%I:%M %p"
DATETIME_FORMAT = f"%Y-%m-%d {TIME_FORMAT}"

# --- Goal and Reporting Constants ---
DAILY_GOAL = timedelta(hours=8)
SHIFT_DEFINITIONS = {
    "Shift 1 (Morning)": (time(0, 0), time(12, 0)),
    "Shift 2 (Afternoon)": (time(12, 0), time(16, 0)),
    "Shift 3 (Evening)": (time(16, 0), time(20, 0)),
    "Shift 4 (Night)": (time(20, 0), time.max),
}