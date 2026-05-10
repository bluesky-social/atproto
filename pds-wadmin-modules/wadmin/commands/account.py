"""
Account management commands.
"""

import click
import os
import shutil
import sys
from typing import Optional
from ..api import PDSClient
from ..config import Config
from ..utils import console, print_success, print_error, print_info
from ..migration import AccountMigrator, MigrationProgress, XRPCError
from rich.console import Console


@click.group()
def account():
    """Account management commands."""
    pass


@account.command(name="list")
@click.pass_context
def list_command(ctx):
    """List all accounts."""
    client: PDSClient = ctx.obj["client"]

    response = client.call("GET", "com.atproto.admin.listNeuroAccounts", params={"limit": 1000})

    if not response.success:
        print_error(f"Failed to list accounts: {response.error}")
        raise click.Abort()

    if response.data is None:
        print_error("No data returned from API")
        raise click.Abort()

    accounts = response.data.get("accounts", [])

    if not accounts:
        print_info("No accounts found")
        return

    headers = ["DID", "HANDLE", "EMAIL", "TYPE"]
    header_parts = [
        f"[bold cyan]{headers[0]}[/bold cyan]",
        f"[bold green]{headers[1]}[/bold green]",
        f"[bold yellow]{headers[2]}[/bold yellow]",
        f"[bold blue]{headers[3]}[/bold blue]",
    ]

    wide = Console(width=32000)
    wide.print("  ".join(header_parts), highlight=False)

    for account in accounts:
        did = account.get("did", "")
        handle = account.get("handle", "?")
        email = account.get("email", "N/A")
        account_type = account.get("accountType", "organization")
        row_parts = [
            f"[cyan]{did}[/cyan]",
            f"[green]{handle}[/green]",
            f"[yellow]{email}[/yellow]",
            f"[blue]{account_type}[/blue]",
        ]
        wide.print("  ".join(row_parts), highlight=False)


@account.command()
@click.argument("did")
@click.pass_context
def delete(ctx, did: str):
    """Delete account permanently (with confirmation)."""
    client: PDSClient = ctx.obj["client"]

    # Fetch account details first
    console.print("Fetching account details...")
    console.print()

    response = client.call("GET", "com.atproto.admin.getNeuroLink", params={"did": did})

    if not response.success:
        print_error("Failed to fetch account details", response.error or "Unknown error")
        raise click.Abort()

    if not response.data:
        print_error("Account not found", f"No account found for DID: {did}")
        raise click.Abort()

    account_info = response.data
    handle = account_info.get("handle") or "N/A"
    email = account_info.get("email") or "N/A"

    # Display account info
    console.print("Account to be deleted:")
    console.print("=" * 63)
    console.print(f"DID:     {did}")
    console.print(f"Handle:  {handle}")
    console.print(f"Email:   {email}")
    console.print()

    # Confirmation prompt
    console.print("⚠️  WARNING: This will PERMANENTLY delete the account and all associated data:")
    console.print("   - Account record")
    console.print("   - Actor record")
    console.print("   - Repository data")
    console.print("   - Email tokens")
    console.print("   - Refresh tokens")
    console.print("   - Neuro identity links (W ID)")
    console.print("   - All user data from sequencer")
    console.print()

    confirm_handle = click.prompt("Type the handle to confirm deletion", type=str)

    if confirm_handle != handle:
        print_error("Handle mismatch. Deletion cancelled.")
        raise click.Abort()

    console.print()
    console.print("Deleting account...")

    delete_response = client.call("POST", "com.atproto.admin.deleteAccount", data={"did": did})

    if not delete_response.success:
        print_error("Failed to delete account", delete_response.error or "Unknown error")
        raise click.Abort()

    print_success("Account deleted successfully")
    console.print(f"  DID: {did}")
    console.print(f"  Handle: {handle}")


@account.command("set-email")
@click.argument("did")
@click.argument("email")
@click.pass_context
def set_email(ctx, did: str, email: str):
    """Set the email address for an account."""
    client: PDSClient = ctx.obj["client"]

    response = client.call(
        "POST",
        "com.atproto.admin.updateAccountEmail",
        data={"account": did, "email": email},
    )

    if not response.success:
        print_error("Failed to update email", response.error or "Unknown error")
        raise click.Abort()

    print_success(f"Email updated")
    console.print(f"  DID:   {did}")
    console.print(f"  Email: {email}")


ACCOUNT_TYPES = ["personal", "bot", "organization", "test", "service"]


@account.command("set-type")
@click.argument("did")
@click.argument("account_type", metavar="TYPE", type=click.Choice(ACCOUNT_TYPES))
@click.pass_context
def set_type(ctx, did: str, account_type: str):
    """Set the account type (personal, bot, organization, test)."""
    client: PDSClient = ctx.obj["client"]

    response = client.call(
        "POST",
        "io.trustanchor.admin.setAccountType",
        data={"did": did, "accountType": account_type},
    )

    if not response.success:
        print_error("Failed to set account type", response.error or "Unknown error")
        raise click.Abort()

    print_success(f"Account type updated")
    console.print(f"  DID:  {did}")
    console.print(f"  Type: {account_type}")


@account.command()
@click.argument("did")
@click.argument("target_pds_url")
@click.option("--handle", default=None, help="New handle for the account on target PDS")
@click.pass_context
def rehome(ctx, did: str, target_pds_url: str, handle: Optional[str]):
    """Rehome account to another PDS in cluster."""
    client: PDSClient = ctx.obj["client"]

    console.print(f"Rehoming account: {did}")
    console.print(f"Target PDS: {target_pds_url}")
    if handle:
        console.print(f"New handle: {handle}")
    console.print()

    # Build request data
    data = {
        "did": did,
        "targetPdsUrl": target_pds_url,
    }
    if handle:
        data["targetHandle"] = handle

    response = client.call("POST", "com.atproto.admin.migrateAccount", data=data)

    if not response.success:
        print_error("Rehome failed", response.error or "Unknown error")
        raise click.Abort()

    if not response.data:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    print_success("Rehome completed!")
    console.print()
    console.print(f"  DID:           {result.get('did', 'N/A')}")
    console.print(f"  Source PDS:    {result.get('sourcePds', 'N/A')}")
    console.print(f"  Target PDS:    {result.get('targetPds', 'N/A')}")
    console.print(f"  Status:        {result.get('status', 'N/A')}")
    console.print(f"  Rehomed At:    {result.get('migratedAt', 'N/A')}")


@account.command("set-main-password")
@click.argument("did_or_handle")
@click.option(
    "--password",
    default=None,
    help="New main password (prompted interactively if omitted)",
)
@click.option(
    "--no-password",
    "remove_password",
    is_flag=True,
    default=False,
    help="Remove the main password, reverting the account to WID-only authentication",
)
@click.pass_context
def set_main_password(ctx, did_or_handle: str, password: Optional[str], remove_password: bool):
    """Set (or remove) the main account password for a DID or handle (admin only).

    Setting a password enables login via https://<pds-host>/account/sign-in
    using the standard username + password form, bypassing WID QR authentication.

    Use --no-password to revert the account to WID-only authentication.

    All existing refresh tokens for the account are revoked in either case.
    """
    client: PDSClient = ctx.obj["client"]

    if remove_password and password is not None:
        print_error("Conflicting options", "Use either --password or --no-password, not both")
        raise click.Abort()

    # Resolve handle to DID if needed
    did = did_or_handle
    if not did_or_handle.startswith("did:"):
        resolve_response = client.call(
            "GET",
            "com.atproto.identity.resolveHandle",
            params={"handle": did_or_handle},
        )
        if not resolve_response.success or not resolve_response.data:
            print_error(
                "Failed to resolve handle",
                resolve_response.error or f"Handle not found: {did_or_handle}",
            )
            raise click.Abort()
        did = resolve_response.data.get("did")
        if not did:
            print_error("Failed to resolve handle", "No DID in response")
            raise click.Abort()
        console.print(f"  Resolved {did_or_handle} → {did}")
        console.print()

    if remove_password:
        data = {"did": did, "removePassword": True}
    else:
        # Prompt for password if not provided on the command line
        if password is None:
            password = click.prompt(
                "New main password",
                hide_input=True,
                confirmation_prompt="Confirm password",
            )
        if len(password) < 8:
            print_error("Password too short", "Must be at least 8 characters")
            raise click.Abort()
        data = {"did": did, "password": password}

    response = client.call(
        "POST",
        "io.trustanchor.admin.setAccountPassword",
        data=data,
    )

    if not response.success:
        print_error(
            "Failed to update password", response.error or "Unknown error"
        )
        raise click.Abort()

    if remove_password:
        print_success("Main password removed (WID-only auth restored)")
        console.print()
        console.print(f"  Account: {did}")
    else:
        print_success("Main password set")
        console.print()
        console.print(f"  Account: {did}")
        console.print()
        console.print(
            "  The account can now sign in at  [bold cyan]<pds-host>/account/sign-in[/bold cyan]"
        )
        console.print("  using the handle and the password you just set.")
    console.print()
    console.print(
        "  [yellow]Note:[/yellow] All existing refresh tokens for this account have been revoked."
    )


@account.command("create-session")
@click.argument("did_or_handle")
@click.pass_context
def create_session(ctx, did_or_handle: str):
    """Create a legacy ATProto session (accessJwt + refreshJwt) for an account without needing its password (admin only).

    Useful for scripted/programmatic access to an account — pipe the tokens
    into goat, httpie, bot scripts, or other ATProto tooling.
    """
    client: PDSClient = ctx.obj["client"]

    # Resolve handle to DID if needed
    did = did_or_handle
    if not did_or_handle.startswith("did:"):
        resolve_response = client.call(
            "GET",
            "com.atproto.identity.resolveHandle",
            params={"handle": did_or_handle},
        )
        if not resolve_response.success or not resolve_response.data:
            print_error(
                "Failed to resolve handle",
                resolve_response.error or f"Handle not found: {did_or_handle}",
            )
            raise click.Abort()
        did = resolve_response.data.get("did")
        if not did:
            print_error("Failed to resolve handle", "No DID in response")
            raise click.Abort()
        console.print(f"  Resolved {did_or_handle} → {did}")
        console.print()

    response = client.call(
        "POST",
        "io.trustanchor.admin.createAccountSession",
        data={"did": did},
    )

    if not response.success:
        print_error("Failed to create session", response.error or "Unknown error")
        raise click.Abort()

    if not response.data:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data
    access_jwt = result.get("accessJwt", "")
    refresh_jwt = result.get("refreshJwt", "")
    handle = result.get("handle", did_or_handle)

    print_success("Session created")
    console.print()
    console.print(f"  Handle:      {handle}")
    console.print(f"  DID:         {did}")
    console.print()
    console.print(f"  accessJwt:   {access_jwt}")
    console.print(f"  refreshJwt:  {refresh_jwt}")


@account.command("create-bot-account")
@click.argument("handle")
@click.option("--email", default=None, help="Email address for the bot account")
@click.pass_context
def create_bot_account(ctx, handle: str, email: Optional[str]):
    """Create a bot account (admin only). Bot accounts are for automated services."""
    client: PDSClient = ctx.obj["client"]

    # Build request body
    data = {"handle": handle}
    if email:
        data["email"] = email

    # Call PDS admin endpoint
    response = client.call("POST", "io.trustanchor.admin.createBotAccount", data=data)

    if not response.success:
        print_error("Failed to create bot account", response.error or "Unknown error")
        raise click.Abort()

    if not response.data:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    print_success("Bot Account Created")
    console.print()
    console.print(f"  Handle:   {result.get('handle', 'N/A')}")
    console.print(f"  DID:      {result.get('did', 'N/A')}")
    console.print(f"  Password: {result.get('appPassword', 'N/A')}")
    console.print()

    # Show deep link if available
    deep_link = result.get("deepLink")
    if deep_link:
        console.print("Deep Link:")
        console.print(f"  {deep_link}")
        console.print()


@account.command("subscribe-to-lists")
@click.argument("did")
@click.option("--list", "lists", multiple=True, required=True, help="AT-URI of list to subscribe to (can be specified multiple times)")
@click.pass_context
def subscribe_to_lists(ctx, did: str, lists: tuple):
    """Subscribe an account to one or more lists."""
    client: PDSClient = ctx.obj["client"]

    console.print(f"Subscribing account {did} to {len(lists)} list(s)...")
    console.print()

    # Build request body
    data = {
        "did": did,
        "lists": list(lists)  # Convert tuple to list
    }

    # Call PDS admin endpoint
    response = client.call("POST", "io.trustanchor.admin.subscribeToLists", data=data)

    if not response.success:
        print_error("Failed to subscribe to lists", response.error or "Unknown error")
        raise click.Abort()

    if not response.data:
        print_error("No data returned from API")
        raise click.Abort()

    result = response.data

    print_success("Subscription Complete")
    console.print()
    console.print(f"  Account:        {did}")
    console.print(f"  Lists Provided: {len(lists)}")
    console.print(f"  Subscribed:     {result.get('subscribedCount', 0)}")
    console.print()

    if lists:
        console.print("Lists:")
        for list_uri in lists:
            console.print(f"  • {list_uri}")


@account.command("set-thread-prefs")
@click.argument("did")
@click.option(
    "--layout",
    type=click.Choice(["threaded", "linear"], case_sensitive=False),
    required=True,
    help="Reply layout: threaded or linear",
)
@click.option(
    "--sort",
    type=click.Choice(
        ["oldest", "newest", "hotness", "most-likes", "random"], case_sensitive=False
    ),
    required=True,
    help="Reply sort order",
)
@click.pass_context
def set_thread_prefs(ctx, did: str, layout: str, sort: str):
    """Set thread view preferences for an account."""
    client: PDSClient = ctx.obj["client"]

    tree_view_enabled = layout.lower() == "threaded"

    console.print(
        f"Setting thread view preferences for account {did}...",
    )
    console.print()

    # Build request body
    data = {"did": did, "treeViewEnabled": tree_view_enabled, "sort": sort.lower()}

    # Call PDS admin endpoint
    response = client.call(
        "POST", "io.trustanchor.admin.setThreadViewPreferences", data=data
    )

    if not response.success:
        print_error(
            "Failed to set thread preferences", response.error or "Unknown error"
        )
        raise click.Abort()

    print_success("Thread Preferences Updated")
    console.print()
    console.print(f"  Account:      {did}")
    console.print(f"  Layout:       {layout} (lab_treeViewEnabled: {tree_view_enabled})")
    console.print(f"  Sort Order:   {sort}")
    console.print()


@account.command()
@click.argument("bsky_handle")
@click.option("--old-password", required=True, help="Current bsky.social password for the account being migrated")
@click.option("--new-handle", required=True, help="Handle on this PDS (e.g. alice.wsocial.eu)")
@click.option("--new-email", required=True, help="Email address for the migrated account")
@click.option("--invite-code", default=None, help="Invite code (auto-generated if omitted)")
@click.option("--new-password", default=None, help="Temporary password on new PDS (random if omitted, remove after migration)")
@click.pass_context
def migrate(ctx, bsky_handle: str, old_password: str, new_handle: str, new_email: str,
            invite_code: Optional[str], new_password: Optional[str]):
    """Migrate a bsky.social account to this PDS.

    BSKY_HANDLE is the user's current handle on bsky.social (e.g. alice.bsky.social).

    Steps:
      1. Log in to bsky.social as the user
      2. Create account shell on this PDS (skipped if already exists)
      3. Import repo CAR (skipped if commit already matches)
      4. Import preferences
      5. Transfer blobs with progress counter (skipped blobs already uploaded)
      --- pauses here to request PLC token ---
      6. Update DID document to point to this PDS (skipped if already done)
      7. Activate account (skipped if already active)
      8. Deactivate account on bsky.social (skipped if already inactive)

    The command is fully idempotent: re-running after any failure resumes
    from where it left off.

    After migration, use 'wid link <did> <jid>' to attach a W ID.
    """
    config: Config = ctx.obj["config"]
    client: PDSClient = ctx.obj["client"]

    # Generate an invite code via the admin API if none was supplied
    if invite_code is None:
        console.print("  Generating invite code...")
        resp = client.call("POST", "com.atproto.server.createInviteCode", data={"useCount": 1})
        if not resp.success or not resp.data:
            print_error("Failed to generate invite code", resp.error or "Unknown error")
            raise click.Abort()
        invite_code = resp.data.get("code")
        if not invite_code:
            print_error("No invite code returned by API")
            raise click.Abort()
        console.print(f"  [dim]Invite code: {invite_code}[/dim]")

    if new_password is None:
        import secrets as _secrets, string as _string
        alphabet = _string.ascii_letters + _string.digits
        new_password = "".join(_secrets.choice(alphabet) for _ in range(24))
        console.print("  [dim]Using temporary password (remove after migration)[/dim]")

    console.print()
    console.print(f"Migrating [bold]{bsky_handle}[/bold] → [bold]{new_handle}[/bold]")
    console.print(f"Target PDS: {config.pds_host}")
    console.print()

    migrator = AccountMigrator(
        old_handle=bsky_handle,
        old_password=old_password,
        new_pds_host=config.pds_host,
        new_pds_admin_password=config.admin_password,
        new_handle=new_handle,
        new_email=new_email,
        new_password=new_password,
        invite_code=invite_code,
    )

    # --- Phase 1: data migration ---
    try:
        for progress in migrator.run():
            _print_progress(progress)
    except XRPCError as e:
        print_error(f"Migration failed at step '{_current_step(e)}'", str(e))
        raise click.Abort()
    except Exception as e:
        print_error("Unexpected error during data migration", str(e))
        raise click.Abort()

    # --- Pause for PLC token ---
    console.print()
    console.print("[bold yellow]Blobs transferred.[/bold yellow] Requesting PLC token...")

    migrator.request_plc_token()

    console.print("  [dim]Token sent to the account's bsky.social email address.[/dim]")
    console.print()
    console.print("Check the email and enter the token below.")
    console.print("[dim](Enter it quickly — tokens expire within minutes)[/dim]")
    console.print()

    plc_token = click.prompt("PLC token").strip()
    if not plc_token:
        print_error("No token entered")
        raise click.Abort()

    # --- Phase 2: identity + activation ---
    try:
        for progress in migrator.finish(plc_token):
            _print_progress(progress)
    except XRPCError as e:
        print_error(f"Migration failed at identity step", str(e))
        console.print()
        console.print("[yellow]Tip:[/yellow] Re-run the same command with the same arguments.")
        console.print("Data steps will be skipped; only the identity update will be retried.")
        raise click.Abort()
    except Exception as e:
        print_error("Unexpected error during identity migration", str(e))
        raise click.Abort()

    console.print()
    did = migrator.did
    print_success(f"Migration complete: {bsky_handle} → {new_handle}")

    # Remove the temporary password — nobody knows it and it serves no purpose
    console.print("  [dim]Removing temporary password...[/dim]")
    client.call("POST", "io.trustanchor.admin.setAccountPassword", data={"did": did, "removePassword": True})

    console.print()
    console.print("Next steps:")
    console.print(f"  [dim]Attach W ID:[/dim]  ./pds-wadmin-prod wid link {did} <jid>")


def _print_progress(p: MigrationProgress):
    if p.blob_total > 0:
        pct = int(100 * p.blob_done / p.blob_total)
        prefix = f"[{p.blob_done}/{p.blob_total} {pct}%]"
    else:
        prefix = f"[{p.step}]"

    if p.skipped:
        console.print(f"  [dim]{prefix} {p.detail} ✓[/dim]")
    else:
        console.print(f"  {prefix} {p.detail}")


def _current_step(e: Exception) -> str:
    # Best-effort: extract step name from traceback context
    import traceback
    tb = traceback.extract_tb(e.__traceback__)
    for frame in reversed(tb):
        if "migration.py" in frame.filename and frame.name.startswith("_step_"):
            return frame.name.replace("_step_", "")
    return "unknown"

