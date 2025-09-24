# src/time_cli_pkg/core.py

"""
Core business logic for time tracking actions (start, stop, add, edit, reset, import/export).
"""

import json
from datetime import datetime
from pathlib import Path
from rich.console import Console

from . import database
from . import reporting
from . import utils
from . import config

console = Console()

# --- Existing Functions (start_tracking, stop_tracking, etc.) ---
def start_tracking():
    """Starts a new time tracking entry."""
    database.init_db()
    if database.get_active_entry():
        console.print("[bold yellow]Warning:[/bold yellow] A timer is already running.")
        reporting.show_status()
        return
    start_time = database.add_start_entry()
    console.print(f"[bold green]Success:[/bold green] Time tracking started at [cyan]{start_time.strftime(config.TIME_FORMAT)}[/cyan].")

def stop_tracking():
    """Stops the currently active time tracking entry."""
    database.init_db()
    active_entry = database.get_active_entry()
    if not active_entry:
        console.print("[bold red]Error:[/bold red] No active timer to stop.")
        return
    start_time = active_entry['start_time']
    end_time = datetime.now()
    database.update_end_entry(active_entry['id'], end_time)
    duration = utils.format_duration_log(start_time, end_time)
    console.print(f"[bold green]Success:[/bold green] Time tracking stopped at [cyan]{end_time.strftime(config.TIME_FORMAT)}[/cyan].")
    console.print(f"Total duration: [bold yellow]{duration}[/bold yellow].")

def add_manual_entry(start_str, end_str, duration_str):
    """Adds a historical time entry based on user input."""
    database.init_db()
    if start_str and end_str: console.print("[bold red]Error:[/bold red] Please provide either --start or --end, not both."); return
    if not start_str and not end_str: console.print("[bold red]Error:[/bold red] You must provide either --start or --end time."); return
    try:
        duration = utils.parse_duration(duration_str)
        today = datetime.now().date()
        if start_str:
            start_time = datetime.combine(today, datetime.strptime(start_str, config.TIME_FORMAT).time())
            end_time = start_time + duration
        else:
            end_time = datetime.combine(today, datetime.strptime(end_str, config.TIME_FORMAT).time())
            start_time = end_time - duration
    except ValueError as e: console.print(f"[bold red]Error:[/bold red] Invalid format. {e}"); return
    
    database.add_manual_entry(start_time, end_time)
    console.print("[bold green]Success![/bold green] Added new log entry:")
    console.print(f"  Date: {start_time.strftime('%Y-%m-%d')}")
    console.print(f"  Start: [cyan]{start_time.strftime(config.TIME_FORMAT)}[/cyan]")
    console.print(f"  End:   [cyan]{end_time.strftime(config.TIME_FORMAT)}[/cyan]")
    console.print(f"  Duration: [yellow]{utils.format_duration_log(start_time, end_time)}[/yellow]")

def edit_entry(partial_id, start_str, end_str, duration_str):
    """Handles the logic for editing a time entry."""
    database.init_db()
    matching_entries = database.find_entry_by_partial_id(partial_id)
    if not matching_entries: console.print(f"[bold red]Error:[/bold red] No entry found with ID starting with '{partial_id}'."); return
    if len(matching_entries) > 1: console.print(f"[bold red]Error:[/bold red] Ambiguous ID. Multiple entries found for '{partial_id}'."); return
    
    entry = matching_entries[0]
    orig_start, orig_end = entry['start_time'], entry['end_time']
    orig_date = orig_start.date()
    new_start, new_end = None, None

    try:
        if start_str and end_str:
            new_start = datetime.combine(orig_date, datetime.strptime(start_str, config.TIME_FORMAT).time())
            new_end = datetime.combine(orig_date, datetime.strptime(end_str, config.TIME_FORMAT).time())
        elif start_str and duration_str:
            new_start = datetime.combine(orig_date, datetime.strptime(start_str, config.TIME_FORMAT).time())
            new_end = new_start + utils.parse_duration(duration_str)
        elif end_str and duration_str:
            new_end = datetime.combine(orig_date, datetime.strptime(end_str, config.TIME_FORMAT).time())
            new_start = new_end - utils.parse_duration(duration_str)
        elif start_str:
            if not orig_end: console.print("[bold red]Error:[/bold red] Cannot set start time on an active entry."); return
            new_start = datetime.combine(orig_date, datetime.strptime(start_str, config.TIME_FORMAT).time())
            new_end = orig_end
        elif end_str:
            new_start = orig_start
            new_end = datetime.combine(orig_date, datetime.strptime(end_str, config.TIME_FORMAT).time())
        else: console.print("[bold red]Error:[/bold red] Invalid combination of arguments."); return
    except ValueError as e: console.print(f"[bold red]Error:[/bold red] Invalid format. {e}"); return

    database.update_entry(entry['id'], new_start, new_end)
    console.print(f"[bold green]Success![/bold green] Entry '{entry['id'][:8]}' updated:")
    console.print(f"  New Start: [cyan]{new_start.strftime(config.DATETIME_FORMAT)}[/cyan]")
    console.print(f"  New End:   [cyan]{new_end.strftime(config.DATETIME_FORMAT)}[/cyan]")
    console.print(f"  New Duration: [yellow]{utils.format_duration_log(new_start, new_end)}[/yellow]")

def reset_all_data():
    """Calls the database function to reset the data and prints status."""
    if database.delete_database():
        console.print("[bold green]Success:[/bold green] All data has been reset.")
    else:
        console.print("[bold yellow]Warning:[/bold yellow] No database found to reset.")

# --- Updated Import/Export Functions ---
def export_data(export_path: Path):
    """Exports all time entries to a JSON file."""
    database.init_db()
    logs = database.get_logs(show_all=True)
    if not logs:
        console.print("[bold yellow]No data to export.[/bold yellow]")
        return
        
    # If the provided path is a directory, create a default filename inside it.
    if export_path.is_dir():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"time_cli_export_{timestamp}.json"
        export_path = export_path / filename
    else:
        # If a full path is given, ensure the parent directory exists.
        export_path.parent.mkdir(parents=True, exist_ok=True)


    # Convert logs to a list of dictionaries, formatting datetimes as ISO strings
    export_data = [
        {
            "id": log["id"],
            "start_time": log["start_time"].isoformat(),
            "end_time": log["end_time"].isoformat() if log["end_time"] else None,
        }
        for log in logs
    ]

    try:
        with open(export_path, "w") as f:
            json.dump(export_data, f, indent=4)
        console.print(f"[bold green]Success:[/bold green] Exported {len(export_data)} entries to [cyan]{export_path}[/cyan].")
    except IOError as e:
        console.print(f"[bold red]Error:[/bold red] Could not write to file: {e}")

def import_data(import_path: Path):
    """Imports time entries from a JSON file."""
    database.init_db()
    try:
        with open(import_path, "r") as f:
            data_to_import = json.load(f)

        # Validate that the loaded data is a list
        if not isinstance(data_to_import, list):
            console.print("[bold red]Error:[/bold red] Invalid JSON format. Expected a list of entries.")
            return

        # Convert ISO string datetimes back to datetime objects
        prepared_entries = [
            {
                "id": entry["id"],
                "start_time": datetime.fromisoformat(entry["start_time"]),
                "end_time": datetime.fromisoformat(entry["end_time"]) if entry.get("end_time") else None,
            }
            for entry in data_to_import
        ]

        database.bulk_insert_entries(prepared_entries)
        console.print(f"[bold green]Success:[/bold green] Imported {len(prepared_entries)} entries from [cyan]{import_path}[/cyan].")

    except FileNotFoundError:
        console.print(f"[bold red]Error:[/bold red] File not found at [cyan]{import_path}[/cyan].")
    except json.JSONDecodeError:
        console.print(f"[bold red]Error:[/bold red] Could not decode JSON. Please check the file format.")
    except (KeyError, TypeError) as e:
        console.print(f"[bold red]Error:[/bold red] Invalid data structure in JSON file. Missing key or wrong type: {e}")