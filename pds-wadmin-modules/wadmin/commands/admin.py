"""
Admin commands for server management.
"""

import click
import subprocess
from pathlib import Path
from typing import Optional
from ..api import PDSClient
from ..config import Config
from ..utils import console, print_success, print_error
from datetime import datetime, timezone


@click.group()
def admin():
    """Server administration commands."""
    pass


@admin.command("build-info")
@click.pass_context
def build_info(ctx):
    """Get PDS build information (version, build time, uptime)."""
    client: PDSClient = ctx.obj["client"]

    console.print("Fetching build information...")
    console.print()

    response = client.call("GET", "io.trustanchor.admin.getBuildInfo")

    if not response.success:
        print_error(f"Failed to fetch build info: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    info = response.data

    # Parse timestamps for display
    try:
        build_time = datetime.fromisoformat(info['buildTime'].replace('Z', '+00:00'))
        build_time_str = build_time.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    except:
        build_time_str = info['buildTime']

    try:
        started_at = datetime.fromisoformat(info['startedAt'].replace('Z', '+00:00'))
        started_at_str = started_at.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    except:
        started_at_str = info['startedAt']

    # Format uptime
    uptime_seconds = info['uptime']
    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    minutes = (uptime_seconds % 3600) // 60
    seconds = uptime_seconds % 60

    if days > 0:
        uptime_str = f"{days}d {hours}h {minutes}m {seconds}s"
    elif hours > 0:
        uptime_str = f"{hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        uptime_str = f"{minutes}m {seconds}s"
    else:
        uptime_str = f"{seconds}s"

    console.print("━" * 63)
    console.print("PDS Build Information", style="bold")
    console.print("━" * 63)
    console.print()
    console.print(f"  Build Hash:    {info['buildHash']}")
    console.print(f"  Build Time:    {build_time_str}")
    console.print(f"  Started At:    {started_at_str}")
    console.print(f"  Uptime:        {uptime_str}")
    console.print(f"  Node Version:  {info['nodeVersion']}")
    console.print()


# ---------------------------------------------------------------------------
# Cluster / infrastructure commands (formerly under 'nomad')
# ---------------------------------------------------------------------------

@admin.command()
@click.pass_context
def status(ctx):
    """Show pod / job status."""
    from .nomad import status_command
    status_command(ctx)


@admin.command()
@click.option("--tail", default=None, type=int, help="Number of lines to tail")
@click.option("--follow", "-f", is_flag=True, help="Follow log output")
@click.pass_context
def log(ctx, tail: Optional[int], follow: bool):
    """Fetch logs from the running PDS container."""
    from .nomad import logs_command
    logs_command(ctx, tail, follow)


@admin.command()
@click.option("--tail", default=None, type=int, help="Number of lines to tail")
@click.pass_context
def logfile(ctx, tail: Optional[int]):
    """Fetch logs and save to timestamped file (pds-<env>YYYYMMDD-HHMM.log.json)."""
    from .nomad import logfile_command
    logfile_command(ctx, tail)


# ---------------------------------------------------------------------------
# Database commands (formerly under 'wid')
# ---------------------------------------------------------------------------

@admin.command()
@click.pass_context
def schema(ctx):
    """Show database schema for key tables."""
    from .wid import schema_command
    schema_command(ctx)


@admin.command()
@click.option("--query", default=None, help="Custom SQL query to execute")
@click.pass_context
def db(ctx, query: Optional[str]):
    """Query neuro_identity_link database."""
    from .wid import db_command
    db_command(ctx, query)


@admin.command("check-db")
@click.argument("did")
@click.pass_context
def check_db(ctx, did: str):
    """Check database consistency for a specific DID."""
    from .wid import check_db_command
    check_db_command(ctx, did)


@admin.command("repair-actor")
@click.argument("did")
@click.pass_context
def repair_actor(ctx, did: str):
    """Re-sequence identity event for a DID to repair a missing AppView actor row.

    Use this when an account shows 'Profile not found' despite existing in the PDS.
    The AppView actor row may be absent if the identity event was dropped due to a
    DID resolution race at account creation time. Re-sequencing the event causes
    the AppView to re-index the actor.
    """
    client: PDSClient = ctx.obj["client"]

    # Look up current handle for this DID
    console.print(f"Looking up handle for [cyan]{did}[/cyan]...")
    response = client.call(
        "GET",
        "com.atproto.admin.getAccountInfos",
        params={"dids": did},
    )

    if not response.success:
        print_error(f"Failed to fetch account info: {response.error}")
        raise click.Abort()

    infos = (response.data or {}).get("infos", [])
    if not infos:
        print_error(f"No account found for DID: {did}")
        raise click.Abort()

    handle = infos[0].get("handle")
    if not handle:
        print_error(f"Account has no handle – cannot re-sequence identity event")
        raise click.Abort()

    console.print(f"Found handle: [green]{handle}[/green]")
    console.print(f"Re-sequencing identity event...")

    response = client.call(
        "POST",
        "com.atproto.admin.updateAccountHandle",
        data={"did": did, "handle": handle},
    )

    if not response.success:
        print_error(f"Failed to re-sequence identity event: {response.error}")
        raise click.Abort()

    print_success(f"Identity event re-sequenced for {did}")
    console.print("The AppView should index this actor within a few seconds.")
    console.print("Verify with: [cyan]wid show <did>[/cyan]")
