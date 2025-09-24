# src/time_cli_pkg/cli.py

import typer
from pathlib import Path
from typing import Optional

from . import core
from . import reporting

cli = typer.Typer()

@cli.command()
def start():
    """Starts a new time tracking entry."""
    core.start_tracking()

@cli.command()
def stop():
    """Stops the current time tracking entry."""
    core.stop_tracking()

@cli.command()
def status():
    """Shows the status of the current entry and daily goal."""
    reporting.show_status()

@cli.command()
def logs(
    date: Optional[str] = typer.Option(
        None, "--date", "-d", help="Show logs for a specific date (YYYY-MM-DD)."
    ),
    all_logs: bool = typer.Option(
        False, "--all", "-a", help="Show all log entries.", rich_help_panel="Filters"
    ),
):
    """Shows time log entries."""
    # Renamed 'all' to 'all_logs' to avoid shadowing the built-in all() function.
    reporting.show_logs(date=date, all_logs=all_logs)

@cli.command()
def add(
    start_str: Optional[str] = typer.Option(None, "--start", "-s", help="Start time (e.g., '10:00 AM')."),
    end_str: Optional[str] = typer.Option(None, "--end", "-e", help="End time (e.g., '02:30 PM')."),
    duration_str: str = typer.Option(..., "--duration", "-d", help="Duration (e.g., '1h30m')."),
):
    """Adds a historical time entry."""
    # '...' as a default value makes an option required.
    core.add_manual_entry(start_str, end_str, duration_str)

@cli.command()
def edit(
    partial_id: str = typer.Argument(..., help="The first few characters of the entry ID to edit."),
    start_str: Optional[str] = typer.Option(None, "--start", help="New start time (e.g., '09:30 AM')."),
    end_str: Optional[str] = typer.Option(None, "--end", help="New end time (e.g., '10:15 AM')."),
    duration_str: Optional[str] = typer.Option(None, "--duration", help="New duration (e.g., '45m')."),
):
    """Edits an existing time entry by its ID."""
    core.edit_entry(partial_id, start_str, end_str, duration_str)

@cli.command()
def export(
    path: Path = typer.Option(
        ..., "--path", help="Path to a file or directory for the JSON export.",
        file_okay=True, dir_okay=True, writable=True
    )
):
    """Exports all time entries to a JSON file."""
    core.export_data(path)

@cli.command(name="import")
def import_from_json(
    path: Path = typer.Option(
        ..., "--path", help="Path of the JSON file to import.",
        exists=True, file_okay=True, dir_okay=False, readable=True
    )
):
    """Imports time entries from a JSON file."""
    # Renamed the function to 'import_from_json' to avoid conflict with Python's 'import' keyword.
    # The command is kept as 'import' for the user via `name="import"`.
    if typer.confirm(f"Are you sure you want to import entries from '{path}'? This may create duplicate entries if they already exist."):
        core.import_data(path)
    else:
        typer.echo("Import cancelled.")

@cli.command()
def reset():
    """Deletes all saved time entries."""
    if typer.confirm("Are you sure you want to delete all data? This cannot be undone.", abort=True):
        core.reset_all_data()

@cli.command()
def stats():
    """Shows a breakdown of time spent per shift for the current day."""
    reporting.show_stats()

if __name__ == "__main__":
    cli()