# src/time_cli_pkg/reporting.py

"""
Functions responsible for displaying data to the user (logs, status, stats).
"""

from datetime import datetime, timedelta
from rich.console import Console
from rich.table import Table

from . import database
from . import utils
from . import config

console = Console()

def show_status():
    """Displays the status of the current entry and progress towards the daily goal."""
    database.init_db()
    today = datetime.now().date()
    completed_seconds = database.get_total_duration_for_date(today)
    total_duration_today = timedelta(seconds=completed_seconds)
    
    active_entry = database.get_active_entry()
    if active_entry:
        start_time = active_entry['start_time']
        active_duration = datetime.now() - start_time
        console.print(f"Active timer running for: [bold cyan]{utils.format_duration_live(start_time, None)}[/bold cyan]")
        total_duration_today += active_duration
    else:
        console.print("No timer is currently running.")

    remaining_duration = config.DAILY_GOAL - total_duration_today
    total_formatted = utils.format_duration_log(datetime.min, datetime.min + total_duration_today)
    
    console.print(f"Total time logged today: [bold yellow]{total_formatted}[/bold yellow]")
    
    if remaining_duration.total_seconds() > 0:
        remaining_formatted = utils.format_duration_log(datetime.min, datetime.min + remaining_duration)
        console.print(f"Time remaining to reach 8-hour goal: [bold red]{remaining_formatted}[/bold red]")
    else:
        surplus_duration = -remaining_duration
        surplus_formatted = utils.format_duration_log(datetime.min, datetime.min + surplus_duration)
        console.print(f"[bold green]Goal reached! :tada:[/bold green] Surplus time: [bold yellow]{surplus_formatted}[/bold yellow]")

def show_logs(date, all_logs):
    """Displays time log entries in a formatted table."""
    database.init_db()
    logs = database.get_logs(filter_date=date, show_all=all_logs)
    if not logs:
        console.print("[bold yellow]No logs found.[/bold yellow]")
        return
    table = Table(title="Time Logs")
    table.add_column("SL", style="dim", width=4, justify="center")
    table.add_column("ID", style="dim", no_wrap=True, justify="center")
    table.add_column("Date", style="magenta", justify="center")
    table.add_column("Start Time", style="cyan", justify="center")
    table.add_column("End Time", style="cyan", justify="center")
    table.add_column("Duration", style="green", justify="center")
    for i, entry in enumerate(logs, 1):
        start_time, end_time = entry['start_time'], entry['end_time']
        duration = utils.format_duration_log(start_time, end_time) if end_time else "[red]In progress[/red]"
        table.add_row(
            str(i), entry['id'][:8], start_time.strftime('%Y-%m-%d'),
            start_time.strftime(config.TIME_FORMAT), end_time.strftime(config.TIME_FORMAT) if end_time else "---", duration
        )
    console.print(table)

def show_stats():
    """Calculates and displays time spent in each shift for the current day."""
    database.init_db()
    today_logs = database.get_logs()
    if not today_logs:
        console.print("[bold yellow]No logs found for today to generate stats.[/bold yellow]")
        return
    shift_totals = {name: timedelta(0) for name in config.SHIFT_DEFINITIONS}
    today_date = datetime.now().date()
    for entry in today_logs:
        log_start, log_end = entry['start_time'], entry['end_time']
        if not log_end: continue
        for shift_name, (shift_start_t, shift_end_t) in config.SHIFT_DEFINITIONS.items():
            shift_start_dt = datetime.combine(today_date, shift_start_t)
            shift_end_dt = datetime.combine(today_date, shift_end_t)
            overlap_start = max(log_start, shift_start_dt)
            overlap_end = min(log_end, shift_end_dt)
            if overlap_start < overlap_end:
                shift_totals[shift_name] += (overlap_end - overlap_start)
    table = Table(title=f"Time Stats for Today ({today_date.strftime('%Y-%m-%d')})")
    table.add_column("Shift", style="cyan", justify="left")
    table.add_column("Total Time (HH:MM)", style="green", justify="center")
    total_day_duration = timedelta(0)
    for name, total_duration in shift_totals.items():
        formatted_duration = utils.format_duration_log(datetime.min, datetime.min + total_duration)
        table.add_row(name, formatted_duration)
        total_day_duration += total_duration
    formatted_total = utils.format_duration_log(datetime.min, datetime.min + total_day_duration)
    table.add_section()
    table.add_row("Total", f"[bold yellow]{formatted_total}[/bold yellow]")
    console.print(table)