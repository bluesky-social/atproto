"""Invitation management commands."""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from tabulate import tabulate

from ..api import PDSClient
from ..config import Config
from ..utils import (

    console,
    print_error,
    print_success,
    print_warning,
    print_info,
    require_brevo_config,
)

# Import Brevo functions (lazy import to avoid dependency if not using Brevo features)
def _get_brevo():
    """Lazy import of Brevo module."""
    try:
        from .. import brevo
        return brevo
    except ImportError as e:
        print_error(
            "Brevo SDK not installed",
            "Install with: pip install sib-api-v3-sdk requests"
        )
        raise click.Abort()


@click.group()
def invitation():
    """Invitation management commands."""
    pass


@invitation.command(name="create-wid")
@click.argument("email")
@click.option("--handle", default=None, help="Preferred handle for the account")
@click.pass_context
def create_wid(ctx, email: str, handle: Optional[str]):
    """Create a WID/QR-based invitation (allocates a W Identity account from inventory)."""
    client: PDSClient = ctx.obj["client"]
    config: Config = ctx.obj["config"]

    # Build request data
    data = {
        "email": email,
        "invitationTimestamp": int(datetime.utcnow().timestamp())
    }

    if handle:
        data["preferredHandle"] = handle

    # Create invitation
    response = client.call("POST", "io.trustanchor.admin.createInvitation", data=data)

    if not response.success:
        print_error(f"Failed to create invitation: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    print_success("Invitation created successfully")
    console.print(f"[cyan]Email:[/cyan] {email}", highlight=False)
    if handle:
        console.print(f"[cyan]Suggested handle:[/cyan] {handle}", highlight=False)
    if "expiresAt" in result:
        console.print(f"[cyan]Expires:[/cyan] {result['expiresAt']}", highlight=False)

    # Send email via Brevo if configured
    onboarding_url = result.get("onboardingUrl")
    qr_code_url = result.get("qrCodeUrl")

    if onboarding_url and qr_code_url and config.has_brevo_config():
        console.print()
        console.print("Sending invitation email via Brevo...")

        try:
            brevo = _get_brevo()
            email_result = brevo.send_invitation_email(
                api_key=config.brevo_api_key,  # type: ignore
                template_id=config.brevo_template_id,  # type: ignore
                email=email,
                onboarding_url=onboarding_url,
                qr_code_url=qr_code_url,
                preferred_handle=handle,
                from_email=config.invitation_email_from or "invitations@wsocial.app",
                from_name=config.invitation_mail_from_name or "W Social Team",
            )

            if email_result["success"]:
                print_success("Email sent successfully")
                if email_result.get("from_name") and email_result.get("from_email"):
                    console.print(f"  From: {email_result['from_name']} <{email_result['from_email']}>")
                elif email_result.get("from_email"):
                    console.print(f"  From: {email_result['from_email']}")
                if email_result.get("message_id"):
                    console.print(f"  Message ID: {email_result['message_id']}")
            else:
                print_error(f"Email sending failed: {email_result.get('error', 'Unknown error')}")

        except Exception as e:
            print_error(f"Email sending failed: {str(e)}")

    elif onboarding_url:
        # Show URL for manual sending
        console.print(f"\n[dim]Onboarding URL: {onboarding_url[:60]}...[/dim]", highlight=False)


@invitation.command(name="create-pass")
@click.argument("email")
@click.option("--handle", default=None, help="Preferred handle for the account")
@click.pass_context
def create_pass(ctx, email: str, handle: Optional[str]):
    """Create a password-based invitation (skips WID; user signs up with email+password)."""
    client: PDSClient = ctx.obj["client"]
    config: Config = ctx.obj["config"]

    # Build request body
    data: dict = {"email": email}
    if handle:
        data["preferredHandle"] = handle

    # Call the new eu.wsocial admin endpoint
    response = client.call("POST", "eu.wsocial.admin.createPassInvitation", data=data)

    if not response.success:
        print_error(f"Failed to create pass invitation: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    print_success("Pass invitation created successfully")
    console.print(f"[cyan]Email:[/cyan] {result.get('email', email)}", highlight=False)
    if result.get("preferredHandle"):
        console.print(f"[cyan]Suggested handle:[/cyan] {result['preferredHandle']}", highlight=False)
    if result.get("inviteCode"):
        console.print(f"[cyan]Invite code:[/cyan] {result['inviteCode']}", highlight=False)
    if result.get("expiresAt"):
        console.print(f"[cyan]Expires:[/cyan] {result['expiresAt']}", highlight=False)

    onboarding_url = result.get("onboardingUrl")

    if onboarding_url and config.has_brevo_config():
        console.print()
        console.print("Sending invitation email via Brevo...")

        # Template 29 only uses ONBOARDING_URL (no QR, no handle param —
        # handle is already baked into the onboarding URL itself)
        pass_template_id = config.brevo_pass_template_id or 29

        try:
            brevo = _get_brevo()
            email_result = brevo.send_invitation_email_with_params(
                api_key=config.brevo_api_key,  # type: ignore
                template_id=pass_template_id,
                email=result.get("email", email),
                params={"ONBOARDING_URL": onboarding_url},
                from_email=config.invitation_email_from or "invitations@wsocial.app",
                from_name=config.invitation_mail_from_name or "W Social Team",
            )

            if email_result["success"]:
                print_success("Email sent successfully")
                if email_result.get("from_name") and email_result.get("from_email"):
                    console.print(f"  From: {email_result['from_name']} <{email_result['from_email']}>")
                if email_result.get("message_id"):
                    console.print(f"  Message ID: {email_result['message_id']}")

                # Add contact to Brevo list 24 (Invited)
                contact_result = brevo.add_contact_to_list(
                    api_key=config.brevo_api_key,  # type: ignore
                    email=result.get("email", email),
                    list_id=brevo.BREVO_INVITED_LIST_ID,
                )
                if contact_result["success"]:
                    console.print(f"  Added to Brevo list {brevo.BREVO_INVITED_LIST_ID} (Invited)")
                else:
                    console.print(f"  [dim]Brevo list add failed: {contact_result['error']}[/dim]")
            else:
                print_error(f"Email sending failed: {email_result.get('error', 'Unknown error')}")

        except Exception as e:
            print_error(f"Email sending failed: {str(e)}")

    elif onboarding_url:
        console.print(f"\n[cyan]Onboarding URL:[/cyan] {onboarding_url}", highlight=False)
    else:
        print_warning("No onboarding URL returned — check PDS_EMAIL_APP_URL / PDS_HOME_URL config")


@invitation.command(name="list")
@click.option("--status", default="pending", help="Filter by status (pending, consumed, expired, revoked, all)")
@click.option("--before", default=None, help="Filter by timestamp (ISO format)")
@click.option("--limit", default=50, help="Maximum number to return")
@click.option("--json", "json_output", is_flag=True, help="Output as JSON")
@click.pass_context
def list_command(ctx, status: str, before: Optional[str], limit: int, json_output: bool):
    """List invitations."""
    client: PDSClient = ctx.obj["client"]

    # Build query parameters
    params = {
        "status": status,
        "limit": limit
    }

    if before:
        params["before"] = before

    # Call API
    response = client.call("GET", "io.trustanchor.admin.listInvitations", params=params)

    if not response.success:
        print_error(f"Failed to list invitations: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    invitations = response.data.get("invitations", [])

    if json_output:
        console.print(json.dumps(response.data, indent=2))
        return

    if not invitations:
        print_info("No invitations found")
        return

    # Format table
    table_data = []
    for inv in invitations:
        # Determine email status
        if inv.get("emailLastSentAt"):
            email_status = "sent"
        elif inv.get("emailLastError"):
            email_status = "failed"
        else:
            email_status = "pending"

        # Truncate JID if present
        jid = inv.get("jid", "-")
        if jid and jid != "-":
            jid = jid[:8] + "..."

        # Determine invitation type
        if inv.get("jid"):
            inv_type = "wid"
        elif inv.get("inviteCode"):
            inv_type = "pass"
        else:
            inv_type = "?"

        table_data.append([
            str(inv.get("id", "")),
            inv.get("email", ""),
            inv.get("preferredHandle", "-"),
            jid,
            inv_type,
            inv.get("status", ""),
            email_status,
            inv.get("createdAt", ""),
            inv.get("consumedAt", "-")
        ])

    # Print with column colors
    headers = ["ID", "EMAIL", "HANDLE", "JID", "TYPE", "STATUS", "EMAIL_STATUS", "CREATED", "CONSUMED"]

    # Print header
    header_parts = []
    header_parts.append(f"[bold cyan]{headers[0]}[/bold cyan]")
    header_parts.append(f"[bold yellow]{headers[1]}[/bold yellow]")
    header_parts.append(f"[bold green]{headers[2]}[/bold green]")
    header_parts.append(f"[bold magenta]{headers[3]}[/bold magenta]")
    header_parts.append(f"[bold white]{headers[4]}[/bold white]")
    header_parts.append(f"[bold blue]{headers[5]}[/bold blue]")
    header_parts.append(f"[bold red]{headers[6]}[/bold red]")
    header_parts.append(f"[bold white]{headers[7]}[/bold white]")
    header_parts.append(f"[bold white]{headers[8]}[/bold white]")

    wide = Console(width=32000)
    wide.print("  ".join(header_parts), highlight=False)

    # Print rows
    for row in table_data:
        row_parts = []
        row_parts.append(f"[cyan]{row[0]}[/cyan]")
        row_parts.append(f"[yellow]{row[1]}[/yellow]")
        row_parts.append(f"[green]{row[2]}[/green]")
        row_parts.append(f"[magenta]{row[3]}[/magenta]")
        row_parts.append(f"[white]{row[4]}[/white]")
        row_parts.append(f"[blue]{row[5]}[/blue]")
        row_parts.append(f"[red]{row[6]}[/red]")
        row_parts.append(f"[white]{row[7]}[/white]")
        row_parts.append(f"[white]{row[8]}[/white]")

        wide.print("  ".join(row_parts), highlight=False)


@invitation.command()
@click.option("--since", default=None, help="Calculate stats since timestamp")
@click.option("--json", "json_output", is_flag=True, help="Output as JSON")
@click.pass_context
def stats(ctx, since: Optional[str], json_output: bool):
    """Show invitation statistics."""
    client: PDSClient = ctx.obj["client"]

    # Build query parameters
    params = {}
    if since:
        params["since"] = since

    response = client.call("GET", "io.trustanchor.admin.getInvitationStats", params=params)

    if not response.success:
        print_error(f"Failed to get stats: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    if json_output:
        console.print(json.dumps(result, indent=2))
        return

    console.print("\n[bold]Invitation Statistics:[/bold]")
    console.print("=" * 40)
    console.print(f"Pending:      {result.get('pending', 0)}")
    console.print(f"Consumed:     {result.get('consumed', 0)}")
    console.print(f"Expired:      {result.get('expired', 0)}")
    console.print(f"Revoked:      {result.get('revoked', 0)}")

    if "consumedSince" in result:
        console.print(f"Consumed Since: {result['consumedSince']}")

    if "conversionRate" in result:
        rate = int(float(result["conversionRate"]) * 100)
        console.print(f"Conversion Rate: {rate}%")

    console.print()


@invitation.command()
@click.argument("identifier")
@click.pass_context
def show(ctx, identifier: str):
    """Show detailed information for an invitation (by email or ID)."""
    client: PDSClient = ctx.obj["client"]

    # Fetch all invitations and filter
    response = client.call("GET", "io.trustanchor.admin.listInvitations", params={"status": "all", "limit": 500})

    if not response.success:
        print_error(f"Failed to fetch invitations: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    invitations = response.data.get("invitations", [])

    # Find invitation by ID or email
    invitation = None
    if identifier.isdigit():
        # Search by ID
        inv_id = int(identifier)
        invitation = next((inv for inv in invitations if inv.get("id") == inv_id), None)
    else:
        # Search by email
        invitation = next((inv for inv in invitations if inv.get("email") == identifier), None)

    if not invitation:
        print_error(f"Invitation not found: {identifier}")
        raise click.Abort()

    # Display details
    console.print()
    console.print(f"[bold cyan]ID:[/bold cyan] {invitation.get('id', 'N/A')}")
    console.print(f"[bold cyan]Email:[/bold cyan] {invitation.get('email', 'N/A')}")
    console.print(f"[bold cyan]Preferred Handle:[/bold cyan] {invitation.get('preferredHandle', 'N/A')}")

    jid = invitation.get("jid", "N/A")
    if jid and jid != "N/A":
        jid_display = jid[:12] + "..."
    else:
        jid_display = "N/A"
    console.print(f"[bold cyan]JID:[/bold cyan] {jid_display}")

    onboarding = invitation.get("onboardingUrl", "N/A")
    if onboarding and onboarding != "N/A":
        onboarding_display = onboarding[:40] + "..."
    else:
        onboarding_display = "N/A"
    console.print(f"[bold cyan]Onboarding URL:[/bold cyan] {onboarding_display}")

    qr_code = invitation.get("qrCodeUrl", "N/A")
    if qr_code and qr_code != "N/A":
        qr_code_display = qr_code[:40] + "..."
    else:
        qr_code_display = "N/A"
    console.print(f"[bold cyan]QR Code URL:[/bold cyan] {qr_code_display}")

    console.print(f"[bold cyan]Status:[/bold cyan] {invitation.get('status', 'N/A')}")
    console.print(f"[bold cyan]Created At:[/bold cyan] {invitation.get('createdAt', 'N/A')}")
    console.print(f"[bold cyan]Expires At:[/bold cyan] {invitation.get('expiresAt', 'N/A')}")
    console.print(f"[bold cyan]Consumed At:[/bold cyan] {invitation.get('consumedAt', 'N/A')}")
    console.print(f"[bold cyan]Consuming DID:[/bold cyan] {invitation.get('consumingDid', 'N/A')}")
    console.print(f"[bold cyan]Consuming Handle:[/bold cyan] {invitation.get('consumingHandle', 'N/A')}")
    console.print(f"[bold cyan]Email Last Sent:[/bold cyan] {invitation.get('emailLastSentAt', 'N/A')}")
    console.print(f"[bold cyan]Email Attempts:[/bold cyan] {invitation.get('emailAttemptCount', 0)}")
    console.print(f"[bold cyan]Email Last Error:[/bold cyan] {invitation.get('emailLastError', 'N/A')}")
    console.print()


@invitation.command()
@click.argument("identifier")
@click.pass_context
def revoke(ctx, identifier: str):
    """Revoke an invitation (by email or ID)."""
    client: PDSClient = ctx.obj["client"]

    # Build request data
    if identifier.isdigit():
        data = {"id": int(identifier)}
    else:
        data = {"email": identifier}

    response = client.call("POST", "io.trustanchor.admin.deleteInvitation", data=data)

    if not response.success:
        print_error(f"Failed to revoke invitation: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    print_success("Success!")
    if result.get("revoked"):
        console.print("Invitation revoked (soft delete)")
    else:
        console.print("Invitation deleted (hard delete - was not pending)")


@invitation.command()
@click.option("--status", required=True, help="Status to purge (consumed, expired, or revoked)")
@click.option("--before", default=None, help="Purge invitations before this timestamp")
@click.option("--no-sync", is_flag=True, help="Skip Brevo sync for consumed invitations")
@click.pass_context
def purge(ctx, status: str, before: Optional[str], no_sync: bool):
    """Batch delete invitations by status."""
    client: PDSClient = ctx.obj["client"]

    # Validate status
    if status not in ("consumed", "expired", "revoked"):
        print_error("Invalid status. Must be: consumed, expired, or revoked")
        raise click.Abort()

    # Build request data
    data = {"status": status}
    if before:
        data["before"] = before

    console.print(f"Purging {status} invitations from PDS...")
    if before:
        console.print(f"Before: {before}")

    response = client.call("POST", "io.trustanchor.admin.purgeInvitations", data=data)

    if not response.success:
        print_error(f"Failed to purge invitations: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data
    deleted_count = result.get("deletedCount", 0)

    print_success(f"Deleted {deleted_count} invitations from PDS")

    # Brevo sync for consumed invitations
    if status == "consumed" and not no_sync and deleted_count > 0:
        config: Config = ctx.obj["config"]

        if config.has_brevo_config():
            console.print()
            console.print("Syncing consumed invitations to Brevo...")

            try:
                brevo = _get_brevo()

                # Get list of consumed invitations to extract emails
                list_response = client.call("GET", "io.trustanchor.admin.listInvitations", params={"status": "consumed"})

                if list_response.success and list_response.data:
                    invitations = list_response.data.get("invitations", [])
                    consumed_emails = [inv.get("email") for inv in invitations if inv.get("email")]

                    if consumed_emails:
                        sync_success = 0
                        sync_fail = 0

                        for email in consumed_emails:
                            # Move from invited (24) to onboarded (27)
                            move_result = brevo.move_contact_between_lists(
                    api_key=config.brevo_api_key,  # type: ignore
                                from_list_id=brevo.BREVO_INVITED_LIST_ID,
                                to_list_id=brevo.BREVO_ONBOARDED_LIST_ID
                            )

                            if move_result["success"]:
                                sync_success += 1
                            else:
                                sync_fail += 1

                        console.print(f"✓ Synced {sync_success} contacts to Brevo onboarded list")
                        if sync_fail > 0:
                            console.print(f"  (Failed to sync {sync_fail} contacts - may not be in invited list)")
                    else:
                        console.print("  No emails found to sync")
                else:
                    console.print("  Failed to fetch consumed invitations for sync")

            except Exception as e:
                console.print(f"  [dim]Brevo sync error: {str(e)}[/dim]")
        else:
            console.print()
            console.print("[dim]Note: Brevo not configured, skipping sync[/dim]")


@invitation.command("sync-brevo")
@click.option("--dry-run", is_flag=True, help="Show what would happen without making changes")
@click.option(
    "--promote-started-after",
    default=48,
    type=int,
    metavar="HOURS",
    help="Move pending contacts from list 24 → 25 after this many hours without progress. Default: 48",
)
@click.pass_context
def sync_brevo(ctx, dry_run: bool, promote_started_after: int):
    """Sync invitation lifecycle to Brevo contact lists.

    Scans all invitations and moves contacts to the correct Brevo list:

    \b
      24 Invited    – invitation email sent, no action yet
      25 Started    – still pending after HOURS (proxy for "opened but didn't finish")
      26 Registered – account created with email+password
      27 Onboarded  – account linked to W Identity

    Run this on a regular schedule (e.g. hourly cron) to keep Brevo in sync.
    """
    from datetime import timezone

    client: PDSClient = ctx.obj["client"]
    config: Config = ctx.obj["config"]

    require_brevo_config(config)

    brevo_mod = _get_brevo()
    api_key = config.brevo_api_key  # type: ignore

    if dry_run:
        console.print("[bold yellow]DRY RUN — no changes will be made[/bold yellow]")
        console.print()

    # ── 1. Fetch all invitations (pending + consumed) ──────────────────────
    console.print("Fetching invitations from PDS...")

    all_invitations = []
    for status in ("pending", "consumed"):
        resp = client.call(
            "GET",
            "io.trustanchor.admin.listInvitations",
            params={"status": status, "limit": 1000},
        )
        if resp.success and resp.data:
            all_invitations.extend(resp.data.get("invitations", []))

    if not all_invitations:
        print_info("No invitations found")
        return

    console.print(f"  {len(all_invitations)} invitations loaded")
    console.print()

    # ── 2. Classify each invitation ────────────────────────────────────────
    # Buckets: to_25, to_26, to_27
    to_25: list = []   # pending + email sent > N hours ago → Started
    to_26: list = []   # consumed + accountType unverified  → Registered
    to_27: list = []   # consumed + jid present             → Onboarded

    now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)

    for inv in all_invitations:
        inv_status = inv.get("status", "")
        email = inv.get("email")
        if not email:
            continue

        if inv_status == "pending":
            # Only promote to 25 if the invitation email was actually sent
            email_sent_at = inv.get("emailLastSentAt")
            if not email_sent_at:
                continue
            try:
                sent_dt = datetime.fromisoformat(email_sent_at.replace("Z", "+00:00"))
                hours_elapsed = (now_utc - sent_dt).total_seconds() / 3600
            except Exception:
                continue
            if hours_elapsed >= promote_started_after:
                to_25.append(inv)

        elif inv_status == "consumed":
            consuming_did = inv.get("consumingDid")
            if not consuming_did:
                continue

            # Ask PDS whether this DID is WID-linked
            neuro_resp = client.call(
                "GET",
                "com.atproto.admin.getNeuroLink",
                params={"did": consuming_did},
            )
            if not neuro_resp.success or not neuro_resp.data:
                console.print(f"  [dim]Could not fetch account info for {consuming_did}, skipping[/dim]")
                continue

            jid = neuro_resp.data.get("jid")
            if jid:
                to_27.append(inv)
            else:
                to_26.append(inv)

    # ── 3. Report classification ───────────────────────────────────────────
    console.print(f"  → list {brevo_mod.BREVO_STARTED_LIST_ID} (Started):    {len(to_25)} contacts"
                  f"  [dim](pending ≥ {promote_started_after}h)[/dim]")
    console.print(f"  → list {brevo_mod.BREVO_REGISTERED_LIST_ID} (Registered): {len(to_26)} contacts"
                  f"  [dim](consumed, email+password)[/dim]")
    console.print(f"  → list {brevo_mod.BREVO_ONBOARDED_LIST_ID} (Onboarded):  {len(to_27)} contacts"
                  f"  [dim](consumed, WID-linked)[/dim]")
    console.print()

    if dry_run:
        if to_25:
            console.print("[bold]Would move to list 25 (Started):[/bold]")
            for inv in to_25:
                console.print(f"  {inv.get('email')}  (sent {inv.get('emailLastSentAt', '?')})")
        if to_26:
            console.print("[bold]Would move to list 26 (Registered):[/bold]")
            for inv in to_26:
                console.print(f"  {inv.get('email')}  (consumed {inv.get('consumedAt', '?')})")
        if to_27:
            console.print("[bold]Would move to list 27 (Onboarded):[/bold]")
            for inv in to_27:
                console.print(f"  {inv.get('email')}  (consumed {inv.get('consumedAt', '?')})")
        return

    # ── 4. Apply moves ─────────────────────────────────────────────────────
    # Each contact lives in exactly one list at a time (the most recent stage).
    # We try each possible source list in reverse-chronological order and stop
    # at the first success, which also removes the contact from that source list.
    def _move_to(inv_list: list, source_lists: list, to_list_id: int, label: str):
        ok = fail = 0
        for inv in inv_list:
            email = inv.get("email")
            moved = False
            for from_id in source_lists:
                result = brevo_mod.move_contact_between_lists(
                    api_key=api_key,
                    email=email,
                    from_list_id=from_id,
                    to_list_id=to_list_id,
                )
                if result["success"]:
                    moved = True
                    break
            if moved:
                ok += 1
            else:
                fail += 1
                console.print(f"  [dim]{email}: could not move to list {to_list_id} from any source[/dim]")
        if ok or fail:
            console.print(f"  list {to_list_id} ({label}): {ok} moved, {fail} failed")

    # 24 → 25: can only come from 24 (never been promoted yet)
    _move_to(to_25,
             [brevo_mod.BREVO_INVITED_LIST_ID],
             brevo_mod.BREVO_STARTED_LIST_ID, "Started")
    # 25 or 24 → 26: contact may have already been promoted to 25
    _move_to(to_26,
             [brevo_mod.BREVO_STARTED_LIST_ID, brevo_mod.BREVO_INVITED_LIST_ID],
             brevo_mod.BREVO_REGISTERED_LIST_ID, "Registered")
    # 26, 25, or 24 → 27: contact could be at any prior stage
    _move_to(to_27,
             [brevo_mod.BREVO_REGISTERED_LIST_ID, brevo_mod.BREVO_STARTED_LIST_ID, brevo_mod.BREVO_INVITED_LIST_ID],
             brevo_mod.BREVO_ONBOARDED_LIST_ID, "Onboarded")

    console.print()
    print_success("Brevo sync complete")


@invitation.command()
@click.pass_context
def stock(ctx):
    client: PDSClient = ctx.obj["client"]
    config: Config = ctx.obj["config"]

    console.print("═" * 63)
    console.print("W Social Invitation System Status")
    console.print("═" * 63)
    console.print()

    # 1. WID Account Inventory
    console.print("📦 WID Account Inventory")
    console.print("─" * 63)

    inv_response = client.call("GET", "io.trustanchor.admin.getInventoryStatus")

    if not inv_response.success:
        console.print("❌ ERROR: Failed to get inventory status")
    else:
        if inv_response.data:
            available = inv_response.data.get("available", 0)
            allocated = inv_response.data.get("allocated", 0)
            consumed = inv_response.data.get("consumed", 0)
            total = inv_response.data.get("total", 0)

            console.print(f"   Total:      {total}")
            console.print(f"   Available:  {available}")
            console.print(f"   Allocated:  {allocated}")
            console.print(f"   Consumed:   {consumed}")
            console.print()

            # Inventory warnings
            if available < 100:
                console.print("   🚨 ERROR: Inventory critically low (< 100 available)")
                console.print("      Action needed: Load more WID accounts immediately")
                console.print("      Run: pds-wadmin wid inventory load <batch-file>")
            elif available < 500:
                console.print("   ⚠️  WARNING: Inventory below recommended threshold (< 500)")
                console.print("      Consider loading more accounts soon")
            else:
                console.print("   ✅ Inventory healthy")

    console.print()

    # 2. Pending Invitations
    console.print("📧 Pending Invitations")
    console.print("─" * 63)

    stats_response = client.call("GET", "io.trustanchor.admin.getInvitationStats")

    if not stats_response.success:
        console.print("❌ ERROR: Failed to get invitation stats")
    else:
        if stats_response.data:
            result = stats_response.data
            email_pending = result.get("email_pending", 0)
            email_sent = result.get("email_sent", 0)
            email_failed = result.get("email_failed", 0)
            consumed = result.get("consumed", 0)
            conversion_rate = result.get("conversionRate")

            console.print(f"   email_pending:  {email_pending}")
            console.print(f"   email_sent:     {email_sent}")
            console.print(f"   email_failed:   {email_failed}")
            console.print(f"   consumed:       {consumed}")
            console.print()

            if conversion_rate is not None:
                rate = int(float(conversion_rate) * 100)
                console.print(f"   Conversion Rate: {rate}%")
            else:
                console.print("   Conversion Rate: N/A")

    console.print()

    # 3. Brevo Lists (if configured)
    console.print("📊 Brevo Lists")
    console.print("─" * 63)

    if config.has_brevo_config():
        try:
            brevo = _get_brevo()

            # Get counts for each onboarding lifecycle list
            waitlist_result   = brevo.get_list_count(config.brevo_api_key, brevo.BREVO_WAITLIST_LIST_ID)  # type: ignore
            invited_result    = brevo.get_list_count(config.brevo_api_key, brevo.BREVO_INVITED_LIST_ID)  # type: ignore
            started_result    = brevo.get_list_count(config.brevo_api_key, brevo.BREVO_STARTED_LIST_ID)  # type: ignore
            registered_result = brevo.get_list_count(config.brevo_api_key, brevo.BREVO_REGISTERED_LIST_ID)  # type: ignore
            onboarded_result  = brevo.get_list_count(config.brevo_api_key, brevo.BREVO_ONBOARDED_LIST_ID)  # type: ignore

            if waitlist_result["success"]:
                console.print(f"   Waitlist   ({brevo.BREVO_WAITLIST_LIST_ID}):  {waitlist_result['count']} contacts")
            if invited_result["success"]:
                console.print(f"   Invited    ({brevo.BREVO_INVITED_LIST_ID}):  {invited_result['count']} contacts")
            if started_result["success"]:
                console.print(f"   Started    ({brevo.BREVO_STARTED_LIST_ID}):  {started_result['count']} contacts")
            if registered_result["success"]:
                console.print(f"   Registered ({brevo.BREVO_REGISTERED_LIST_ID}):  {registered_result['count']} contacts")
            if onboarded_result["success"]:
                console.print(f"   Onboarded  ({brevo.BREVO_ONBOARDED_LIST_ID}):  {onboarded_result['count']} contacts")

        except Exception as e:
            console.print(f"   [dim]Error fetching Brevo list counts: {str(e)}[/dim]")
    else:
        console.print("   [dim]Brevo not configured (set BREVO_API_KEY and BREVO_INVITATION_TEMPLATE_ID)[/dim]")

    console.print()

    console.print("═" * 63)


@invitation.command("send-batch-wid")
@click.option("--from-list", default=None, type=int, help="Fetch contacts from Brevo list ID (23=Waitlist, 24=Invited, 27=Onboarded)")
@click.option("--count", default=0, type=int, help="Number of contacts to fetch from Brevo list")
@click.option("--emails", default=None, help="Comma-separated email list")
@click.option("--emails-file", type=click.Path(exists=True), help="File with emails (one per line)")
@click.option("--dry-run", is_flag=True, help="Show what would happen without sending")
@click.pass_context
def send_batch_wid(ctx, from_list: Optional[int], count: int, emails: Optional[str], emails_file: Optional[str], dry_run: bool):
    """Send WID invitations in batch (allocates one W Identity per recipient)."""
    client: PDSClient = ctx.obj["client"]
    config: Config = ctx.obj["config"]

    # Determine email source
    email_list: List[str] = []

    if from_list:
        if not config.has_brevo_config():
            print_error(
                "Brevo not configured",
                "Set BREVO_API_KEY and BREVO_INVITATION_TEMPLATE_ID in Vault or environment"
            )
            raise click.Abort()

        console.print(f"Fetching contacts from Brevo list {from_list}...")

        try:
            brevo = _get_brevo()
            result = brevo.get_list_contacts(
                api_key=config.brevo_api_key,  # type: ignore
                list_id=from_list,
                limit=count if count > 0 else 500
            )

            if not result["success"]:
                print_error(f"Failed to fetch contacts: {result.get('error')}")
                raise click.Abort()

            email_list = [contact["email"] for contact in result["contacts"]]
            console.print(f"✓ Fetched {len(email_list)} contacts from list {from_list}")
            console.print()

        except Exception as e:
            print_error(f"Failed to fetch contacts: {str(e)}")
            raise click.Abort()

    elif emails:
        email_list = [e.strip() for e in emails.split(",") if e.strip()]

    elif emails_file:
        with open(emails_file, 'r') as f:
            email_list = [line.strip() for line in f if line.strip()]

    else:
        print_error("Must specify --from-list, --emails, or --emails-file")
        raise click.Abort()

    batch_size = len(email_list)

    if batch_size == 0:
        print_error("No emails to send to")
        raise click.Abort()

    if batch_size > 500:
        print_error(f"Batch size too large ({batch_size}). Maximum is 500 emails per batch.")
        raise click.Abort()

    console.print()
    console.print("═" * 63)
    console.print("Batch Invitation Send")
    console.print("═" * 63)
    console.print(f"Emails to send: {batch_size}")
    console.print()

    # Pre-flight: Check WID inventory
    console.print("Checking WID inventory...")
    inv_response = client.call("GET", "io.trustanchor.admin.getInventoryStatus")

    if not inv_response.success:
        print_error("Failed to check inventory")
        raise click.Abort()

    if inv_response.data is None:
        print_error("No inventory data returned")
        raise click.Abort()

    available = inv_response.data.get("available", 0)

    if available < batch_size:
        print_error("Insufficient WID inventory")
        console.print(f"   Available: {available}")
        console.print(f"   Required:  {batch_size}")
        console.print("   Load more accounts with: pds-wadmin wid inventory load <batch-file>")
        raise click.Abort()

    print_success(f"WID inventory sufficient ({available} available)")
    console.print()

    # Dry run mode
    if dry_run:
        console.print("🔍 DRY RUN MODE - No invitations will be created or emails sent")
        console.print()
        console.print("Would send invitations to:")
        for email in email_list:
            console.print(f"  {email}")
        console.print()
        console.print("To proceed, re-run without --dry-run flag")
        return

    # Confirmation prompt
    if not click.confirm(f"Send {batch_size} invitations?"):
        console.print("Cancelled")
        return

    console.print()
    console.print("Sending invitations...")
    console.print()

    success_count = 0
    fail_count = 0
    email_success_count = 0
    email_fail_count = 0
    errors = []

    # Check if we should send emails
    send_emails = config.has_brevo_config()
    brevo_module = None

    if send_emails:
        try:
            brevo_module = _get_brevo()
        except Exception:
            send_emails = False

    for email in email_list:
        console.print(f"  {email} ... ", end="")

        # Create invitation
        data = {
            "email": email,
            "invitationTimestamp": int(datetime.utcnow().timestamp())
        }

        response = client.call("POST", "io.trustanchor.admin.createInvitation", data=data)

        if response.success:
            console.print("✓ invite", style="success", end="")
            success_count += 1

            # Send email if configured
            if send_emails and brevo_module and response.data:
                onboarding_url = response.data.get("onboardingUrl")
                qr_code_url = response.data.get("qrCodeUrl")

                if onboarding_url and qr_code_url:
                    try:
                        email_result = brevo_module.send_invitation_email(
                            api_key=config.brevo_api_key,  # type: ignore
                            template_id=config.brevo_template_id,  # type: ignore
                            email=email,
                            onboarding_url=onboarding_url,
                            qr_code_url=qr_code_url,
                            preferred_handle=None,
                            from_email=config.invitation_email_from or "invitations@wsocial.app",
                            from_name=config.invitation_mail_from_name or "W Social Team",
                        )

                        if email_result["success"]:
                            console.print(" ✓ email", style="success", end="")
                            email_success_count += 1

                            # Move contact to invited list if from Brevo
                            if from_list:
                                move_result = brevo_module.move_contact_between_lists(
                                    api_key=config.brevo_api_key,  # type: ignore
                                    email=email,
                                    from_list_id=from_list,
                                    to_list_id=brevo_module.BREVO_INVITED_LIST_ID
                                )
                                if move_result["success"]:
                                    console.print(" ✓ moved", style="success")
                                else:
                                    console.print(" - (already moved?)", style="dim")
                            else:
                                console.print()
                        else:
                            console.print(" ✗ email", style="error")
                            email_fail_count += 1
                            errors.append(f"{email}: Email failed - {email_result.get('error')}")
                    except Exception as e:
                        console.print(" ✗ email", style="error")
                        email_fail_count += 1
                        errors.append(f"{email}: Email error - {str(e)}")
                else:
                    console.print()
            else:
                console.print()
        else:
            console.print("✗", style="error")
            fail_count += 1
            errors.append(f"{email}: {response.error}")

    console.print()
    console.print("═" * 63)
    console.print("Batch Send Complete")
    console.print("═" * 63)
    console.print(f"✓ Invitations Created: {success_count}")
    console.print(f"✗ Invitations Failed:  {fail_count}")

    if send_emails:
        console.print(f"✓ Emails Sent:         {email_success_count}")
        console.print(f"✗ Emails Failed:       {email_fail_count}")

    if fail_count > 0 or email_fail_count > 0:
        console.print()
        console.print("Errors:")
        for error in errors:
            console.print(f"  {error}")


@invitation.command("send-batch-pass")
@click.option("--from-list", default=None, type=int, help="Fetch contacts from Brevo list ID")
@click.option("--count", default=0, type=int, help="Number of contacts to fetch from Brevo list")
@click.option("--emails", default=None, help="Comma-separated email list")
@click.option("--emails-file", type=click.Path(exists=True), help="File with emails (one per line)")
@click.option("--dry-run", is_flag=True, help="Show what would happen without sending")
@click.pass_context
def send_batch_pass(ctx, from_list: Optional[int], count: int, emails: Optional[str], emails_file: Optional[str], dry_run: bool):
    """Send email+password invitations in batch (no WID allocation)."""
    client: PDSClient = ctx.obj["client"]
    config: Config = ctx.obj["config"]

    # Determine email source
    email_list: List[str] = []

    if from_list:
        if not config.has_brevo_config():
            print_error(
                "Brevo not configured",
                "Set BREVO_API_KEY and BREVO_INVITATION_TEMPLATE_ID in Vault or environment"
            )
            raise click.Abort()

        console.print(f"Fetching contacts from Brevo list {from_list}...")

        try:
            brevo = _get_brevo()
            result = brevo.get_list_contacts(
                api_key=config.brevo_api_key,  # type: ignore
                list_id=from_list,
                limit=count if count > 0 else 500
            )

            if not result["success"]:
                print_error(f"Failed to fetch contacts: {result.get('error')}")
                raise click.Abort()

            email_list = [contact["email"] for contact in result["contacts"]]
            console.print(f"✓ Fetched {len(email_list)} contacts from list {from_list}")
            console.print()

        except Exception as e:
            print_error(f"Failed to fetch contacts: {str(e)}")
            raise click.Abort()

    elif emails:
        email_list = [e.strip() for e in emails.split(",") if e.strip()]

    elif emails_file:
        with open(emails_file, 'r') as f:
            email_list = [line.strip() for line in f if line.strip()]

    else:
        print_error("Must specify --from-list, --emails, or --emails-file")
        raise click.Abort()

    batch_size = len(email_list)

    if batch_size == 0:
        print_error("No emails to send to")
        raise click.Abort()

    if batch_size > 500:
        print_error(f"Batch size too large ({batch_size}). Maximum is 500 emails per batch.")
        raise click.Abort()

    console.print()
    console.print("═" * 63)
    console.print("Batch Pass Invitation Send")
    console.print("═" * 63)
    console.print(f"Emails to send: {batch_size}")
    console.print()

    if dry_run:
        console.print("🔍 DRY RUN MODE - No invitations will be created or emails sent")
        console.print()
        console.print("Would send pass invitations to:")
        for email in email_list:
            console.print(f"  {email}")
        console.print()
        console.print("To proceed, re-run without --dry-run flag")
        return

    if not click.confirm(f"Send {batch_size} pass invitations?"):
        console.print("Cancelled")
        return

    console.print()
    console.print("Sending pass invitations...")
    console.print()

    send_emails = config.has_brevo_config()
    brevo_module = None
    pass_template_id = config.brevo_pass_template_id or 29

    if send_emails:
        try:
            brevo_module = _get_brevo()
        except Exception:
            send_emails = False

    success_count = 0
    fail_count = 0
    email_success_count = 0
    email_fail_count = 0
    errors: List[str] = []

    for email in email_list:
        console.print(f"  {email} ... ", end="")

        data: dict = {"email": email}
        response = client.call("POST", "eu.wsocial.admin.createPassInvitation", data=data)

        if not response.success:
            console.print("✗", style="error")
            fail_count += 1
            errors.append(f"{email}: {response.error}")
            continue

        console.print("✓ invite", style="success", end="")
        success_count += 1

        if send_emails and brevo_module and response.data:
            onboarding_url = response.data.get("onboardingUrl")
            if onboarding_url:
                try:
                    email_result = brevo_module.send_invitation_email_with_params(
                        api_key=config.brevo_api_key,  # type: ignore
                        template_id=pass_template_id,
                        email=email,
                        params={"ONBOARDING_URL": onboarding_url},
                        from_email=config.invitation_email_from or "invitations@wsocial.app",
                        from_name=config.invitation_mail_from_name or "W Social Team",
                    )

                    if email_result["success"]:
                        console.print(" ✓ email", style="success", end="")
                        email_success_count += 1

                        # Add to list 24 (Invited), or move from source list if using --from-list
                        if from_list and from_list != brevo_module.BREVO_INVITED_LIST_ID:
                            move_result = brevo_module.move_contact_between_lists(
                                api_key=config.brevo_api_key,  # type: ignore
                                email=email,
                                from_list_id=from_list,
                                to_list_id=brevo_module.BREVO_INVITED_LIST_ID,
                            )
                            if move_result["success"]:
                                console.print(" ✓ moved", style="success")
                            else:
                                console.print(" - (move skipped)", style="dim")
                        else:
                            add_result = brevo_module.add_contact_to_list(
                                api_key=config.brevo_api_key,  # type: ignore
                                email=email,
                                list_id=brevo_module.BREVO_INVITED_LIST_ID,
                            )
                            if add_result["success"]:
                                console.print(" ✓ list24", style="success")
                            else:
                                console.print()
                    else:
                        console.print(" ✗ email", style="error")
                        email_fail_count += 1
                        errors.append(f"{email}: Email failed - {email_result.get('error')}")
                except Exception as e:
                    console.print(" ✗ email", style="error")
                    email_fail_count += 1
                    errors.append(f"{email}: Email error - {str(e)}")
            else:
                console.print()
        else:
            console.print()

    console.print()
    console.print("═" * 63)
    console.print("Batch Pass Send Complete")
    console.print("═" * 63)
    console.print(f"✓ Invitations Created: {success_count}")
    console.print(f"✗ Invitations Failed:  {fail_count}")

    if send_emails:
        console.print(f"✓ Emails Sent:         {email_success_count}")
        console.print(f"✗ Emails Failed:       {email_fail_count}")

    if errors:
        console.print()
        console.print("Errors:")
        for error in errors:
            console.print(f"  {error}")


@invitation.command("list-contacts")
@click.option("--brevo-list", "--list", required=True, type=int, help="Brevo list ID (23=Waitlist, 24=Invited, 27=Onboarded)")
@click.option("--limit", default=100, help="Maximum contacts to fetch")
@click.pass_context
def list_contacts(ctx, brevo_list: int, limit: int):
    """List contacts from a Brevo list."""
    config: Config = ctx.obj["config"]

    if not config.has_brevo_config():
        print_error(
            "Brevo not configured",
            "Set BREVO_API_KEY and BREVO_INVITATION_TEMPLATE_ID in Vault or environment"
        )
        raise click.Abort()

    console.print(f"Fetching contacts from Brevo list {brevo_list}...")
    console.print()

    try:
        brevo = _get_brevo()
        result = brevo.get_list_contacts(
            api_key=config.brevo_api_key,  # type: ignore
            list_id=brevo_list,
            limit=limit
        )

        if not result["success"]:
            print_error(f"Failed to fetch contacts: {result.get('error')}")
            raise click.Abort()

        console.print(f"Total contacts in list: {result['count']}")
        console.print()

        for contact in result["contacts"]:
            console.print(contact["email"])

    except Exception as e:
        print_error(f"Failed to fetch contacts: {str(e)}")
        raise click.Abort()


@invitation.command("move-contact")
@click.argument("email")
@click.option("--from-list", required=True, type=int, help="Source Brevo list ID")
@click.option("--to-list", required=True, type=int, help="Destination Brevo list ID")
@click.pass_context
def move_contact(ctx, email: str, from_list: int, to_list: int):
    """Move a contact between Brevo lists."""
    config: Config = ctx.obj["config"]

    if not config.has_brevo_config():
        print_error(
            "Brevo not configured",
            "Set BREVO_API_KEY and BREVO_INVITATION_TEMPLATE_ID in Vault or environment"
        )
        raise click.Abort()

    console.print(f"Moving {email} from list {from_list} → {to_list}...")

    try:
        brevo = _get_brevo()
        result = brevo.move_contact_between_lists(
            api_key=config.brevo_api_key,  # type: ignore
            email=email,
            from_list_id=from_list,
            to_list_id=to_list
        )

        if result["success"]:
            print_success("Contact moved successfully")
        else:
            print_error(f"Failed to move contact: {result.get('error')}")
            raise click.Abort()

    except Exception as e:
        print_error(f"Failed to move contact: {str(e)}")
        raise click.Abort()


@invitation.command()
@click.argument("jid")
@click.option("--handle", default=None, help="Preferred handle for the account (optional)")
@click.pass_context
def connect(ctx, jid: str, handle: Optional[str]):
    """Pre-authorise a JID to create an account without sending an email.

    Inserts a pending invitation keyed only by JID.  When the user with that
    JID attempts a QuickLogin for the first time, the system will find this
    invitation and allow the account to be created automatically.

    Example:
        ./pds-wadmin invitation connect f0d860cc-60c0-4260-b54f-782c9d9a749f@auth.widentity.eu
    """
    from .wid import exec_sqlite

    config: Config = ctx.obj["config"]

    # Store only the local part (UUID before @) to match what the server stores
    # for webhook-linked invitations. getInvitationByJid also compares local
    # parts only, so login will work regardless of which domain the user logs in from.
    jid_local = jid.split('@')[0]

    now = datetime.utcnow()
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    ts = int(now.timestamp())
    # 30-day expiry to match the standard invitation lifetime
    expiry_iso = datetime.utcfromtimestamp(ts + 30 * 24 * 3600).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    # Synthetic email placeholder — keeps the NOT NULL constraint happy
    synthetic_email = f"jid-connect-{ts}@noemail.invalid"

    preferred = handle or ""

    sql = (
        "INSERT INTO pending_invitations "
        "(email, jid, preferred_handle, invitation_timestamp, created_at, expires_at, status) "
        "VALUES ("
        f"'{synthetic_email}', '{jid_local}', "
        + (f"'{preferred}'" if preferred else "NULL") +
        f", {ts}, '{now_iso}', '{expiry_iso}', 'pending'"
        ");"
    )

    output = exec_sqlite(config, sql)
    if output and output.strip():
        print_warning(f"SQL output: {output.strip()}")

    print_success(f"JID pre-authorised for account creation")
    console.print(f"[cyan]JID:[/cyan]     {jid}", highlight=False)
    if preferred:
        console.print(f"[cyan]Handle:[/cyan]  {preferred}", highlight=False)
    console.print(f"[cyan]Expires:[/cyan] {expiry_iso}", highlight=False)
    console.print(
        "[dim]The account will be created automatically on first QuickLogin.[/dim]",
        highlight=False,
    )
