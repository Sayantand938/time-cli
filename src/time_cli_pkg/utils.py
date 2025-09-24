# src/time_cli_pkg/utils.py

"""
Utility functions for time parsing and formatting.
"""

import re
from datetime import datetime, timedelta

def parse_duration(duration_str: str) -> timedelta:
    """Parses a duration string like '1h30m' into a timedelta object."""
    if not duration_str: raise ValueError("Duration string cannot be empty.")
    parts = re.findall(r'(\d+)\s*(h|m)', duration_str, re.IGNORECASE)
    if not parts: raise ValueError("Invalid duration format. Use '1h', '30m', or '1h30m'.")
    total_minutes = 0
    for value, unit in parts:
        value = int(value)
        if unit.lower() == 'h': total_minutes += value * 60
        elif unit.lower() == 'm': total_minutes += value
    return timedelta(minutes=total_minutes)

def format_duration_live(start_time, end_time):
    """Formats duration into a readable string with seconds (e.g., '1h 30m 5s')."""
    if end_time is None: end_time = datetime.now()
    duration = end_time - start_time
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours}h {minutes}m {seconds}s"

def format_duration_log(start_time, end_time):
    """Formats duration into HH:MM format (e.g., '01:30')."""
    if end_time is None: return "In progress"
    duration = end_time - start_time
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}"