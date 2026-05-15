"""
Account migration between atproto PDSes.

Implements all XRPC steps that goat account migrate performs, but with:
  - Idempotency: each step checks current state and skips if already done
  - Progress: blob transfer shows n/total count
  - Token timing: PLC token is requested AFTER blobs are done, minimising
    the window between request and use
  - Resumability: safe to re-run after any failure; the migrator checks
    account status on the new PDS to determine where to continue from
"""

import secrets
import string
import time
from dataclasses import dataclass, field
from typing import Callable, Generator, Iterator, Optional
from io import BytesIO

import requests


@dataclass
class MigrationProgress:
    step: str
    detail: str = ""
    blob_done: int = 0
    blob_total: int = 0
    skipped: bool = False


@dataclass
class _Session:
    """Holds an authenticated atproto session."""
    host: str
    did: str
    access_jwt: str
    refresh_jwt: str

    def auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self.access_jwt}"}


def _xrpc_get(
    host: str,
    nsid: str,
    params: Optional[dict] = None,
    headers: Optional[dict] = None,
    timeout: int = 60,
) -> dict:
    url = f"{host.rstrip('/')}/xrpc/{nsid}"
    r = requests.get(url, params=params or {}, headers=headers or {}, timeout=timeout)
    _raise_for_xrpc(r)
    return r.json() if r.content else {}


def _xrpc_post(
    host: str,
    nsid: str,
    body=None,
    headers: Optional[dict] = None,
    raw_body: Optional[bytes] = None,
    content_type: str = "application/json",
    timeout: int = 60,
) -> dict:
    url = f"{host.rstrip('/')}/xrpc/{nsid}"
    h = dict(headers or {})
    if raw_body is not None:
        h.setdefault("Content-Type", content_type)
        r = requests.post(url, data=raw_body, headers=h, timeout=timeout)
    else:
        r = requests.post(url, json=body, headers=h, timeout=timeout)
    _raise_for_xrpc(r)
    return r.json() if r.content else {}


def _raise_for_xrpc(r: requests.Response):
    if r.ok:
        return
    try:
        err = r.json()
        code = err.get("error", "")
        msg = err.get("message", r.text)
    except Exception:
        code = ""
        msg = r.text
    raise XRPCError(r.status_code, code, msg)


class XRPCError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message
        super().__init__(f"API request failed (HTTP {status}): {code}: {message}")


def _login(host: str, identifier: str, password: str) -> _Session:
    resp = _xrpc_post(host, "com.atproto.server.createSession", {
        "identifier": identifier,
        "password": password,
    })
    return _Session(
        host=host,
        did=resp["did"],
        access_jwt=resp["accessJwt"],
        refresh_jwt=resp["refreshJwt"],
    )


def _check_account_status(sess: _Session) -> dict:
    return _xrpc_get(sess.host, "com.atproto.server.checkAccountStatus",
                     headers=sess.auth_headers())


def _resolve_handle(host: str, handle: str) -> str:
    resp = _xrpc_get(host, "com.atproto.identity.resolveHandle", {"handle": handle})
    return resp["did"]


def _get_service_auth(sess: _Session, aud: str, lxm: str) -> str:
    """Ask the current PDS to mint a service-auth token scoped to aud+lxm."""
    exp = int(time.time()) + 60
    resp = _xrpc_get(
        sess.host,
        "com.atproto.server.getServiceAuth",
        params={"aud": aud, "exp": exp, "lxm": lxm},
        headers=sess.auth_headers(),
    )
    return resp["token"]


class AccountMigrator:
    """
    Migrates an account from one atproto PDS to another.

    Usage::

        migrator = AccountMigrator(
            old_handle="alice.bsky.social",
            old_password="...",
            new_pds_host="https://pds.wsocial.network",
            new_pds_admin_password="...",
            new_handle="alice.wsocial.eu",
            new_email="alice@example.com",
        )
        for progress in migrator.run():
            print(progress.step, progress.detail)

    The generator yields a :class:`MigrationProgress` for each step.  When it
    reaches the PLC identity step it raises :class:`PLCTokenRequired` — the
    caller should request a token (e.g. via ``account plc request-token``),
    collect it interactively, then call ``migrator.run_identity(token)`` to
    finish.

    The entire process is idempotent: re-running after a failure skips already-
    completed steps.
    """

    def __init__(
        self,
        old_handle: str,
        old_password: str,
        new_pds_host: str,
        new_pds_admin_password: str,
        new_handle: str,
        new_email: str,
        new_password: Optional[str] = None,
        invite_code: Optional[str] = None,
    ):
        self.old_handle = old_handle
        self.old_password = old_password
        self.new_pds_host = new_pds_host.rstrip("/")
        self.new_pds_admin_password = new_pds_admin_password
        self.new_handle = new_handle
        self.new_email = new_email
        self.new_password = new_password or _random_password()
        self.invite_code = invite_code

        # Populated during run()
        self._old_sess: Optional[_Session] = None
        self._new_sess: Optional[_Session] = None
        self._did: Optional[str] = None
        self._new_host_did: Optional[str] = None   # service DID of the new PDS
        self._all_blob_cids: list[str] = []

    @property
    def did(self) -> str:
        if self._did is None:
            raise RuntimeError("run() must be called before accessing did")
        return self._did

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    def run(self) -> Generator[MigrationProgress, None, None]:
        """
        Run data migration steps (1-4).  Yields progress.

        After this generator is exhausted the caller must:
          1. Request a PLC token (email to the account's email address)
          2. Call ``finish(plc_token)``
        """
        yield from self._step_login()
        yield from self._step_create_account()
        yield from self._step_import_repo()
        yield from self._step_import_prefs()
        yield from self._step_transfer_blobs()

    def request_plc_token(self):
        """Request a PLC operation token via the old PDS (sent to the account's email)."""
        if self._old_sess is None:
            raise RuntimeError("run() must be called before request_plc_token()")
        _xrpc_post(
            self._old_sess.host,
            "com.atproto.identity.requestPlcOperationSignature",
            headers=self._old_sess.auth_headers(),
        )

    def finish(self, plc_token: str) -> Generator[MigrationProgress, None, None]:
        """
        Run identity + finalisation steps (5-7).  Yields progress.

        Must be called after ``run()`` has completed.
        If the sessions have expired they are refreshed automatically.
        """
        self._ensure_sessions()
        yield from self._step_update_identity(plc_token)
        yield from self._step_activate()
        yield from self._step_deactivate_old()

    # ------------------------------------------------------------------
    # Step implementations
    # ------------------------------------------------------------------

    def _step_login(self) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("login", f"Resolving {self.old_handle}")
        old_pds_host = _discover_old_pds(self.old_handle)
        yield MigrationProgress("login", f"Logging in to {old_pds_host}")
        self._old_sess = _login(old_pds_host, self.old_handle, self.old_password)
        self._did = self._old_sess.did

        yield MigrationProgress("login", f"Authenticated as {self._did}")

        # Discover the new PDS service DID
        desc = _xrpc_get(self.new_pds_host, "com.atproto.server.describeServer")
        self._new_host_did = desc["did"]
        yield MigrationProgress("login", f"New PDS service DID: {self._new_host_did}")

    def _step_create_account(self) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("create_account", "Creating account on new PDS")

        # Get a service-auth token from bsky.social scoped to createAccount on new PDS
        svc_token = _get_service_auth(
            self._old_sess,
            aud=self._new_host_did,
            lxm="com.atproto.server.createAccount",
        )

        body = {
            "did": self._did,
            "handle": self.new_handle,
            "password": self.new_password,
            "email": self.new_email,
        }
        if self.invite_code:
            body["inviteCode"] = self.invite_code

        try:
            resp = _xrpc_post(
                self.new_pds_host,
                "com.atproto.server.createAccount",
                body=body,
                headers={"Authorization": f"Bearer {svc_token}"},
            )
            self._new_sess = _Session(
                host=self.new_pds_host,
                did=self._did,
                access_jwt=resp["accessJwt"],
                refresh_jwt=resp["refreshJwt"],
            )
            yield MigrationProgress("create_account", "Account created")

        except XRPCError as e:
            if e.code not in ("AlreadyExists",):
                raise
            # Account already exists from a previous run — get a session via admin API
            yield MigrationProgress("create_account", "Account already exists — obtaining session via admin", skipped=True)
            self._new_sess = _admin_session(self.new_pds_host, self.new_pds_admin_password, self._did)

    def _step_import_repo(self) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("import_repo", "Checking repo status")

        status = _check_account_status(self._new_sess)
        old_status = _check_account_status(self._old_sess)
        if status.get("repoCommit") and status["repoCommit"] == old_status.get("repoCommit"):
            yield MigrationProgress("import_repo", "Repo already matches — skipping", skipped=True)
            return

        yield MigrationProgress("import_repo", f"Downloading repo CAR from {self._old_sess.host}")
        url = f"{self._old_sess.host}/xrpc/com.atproto.sync.getRepo"
        r = requests.get(url, params={"did": self._did},
                         headers=self._old_sess.auth_headers(), timeout=300, stream=True)
        _raise_for_xrpc(r)
        car_bytes = r.content

        yield MigrationProgress("import_repo", f"Uploading repo ({len(car_bytes):,} bytes)")
        _xrpc_post(
            self.new_pds_host,
            "com.atproto.repo.importRepo",
            raw_body=car_bytes,
            content_type="application/vnd.ipld.car",
            headers=self._new_sess.auth_headers(),
            timeout=300,
        )
        yield MigrationProgress("import_repo", "Repo imported")

    def _step_import_prefs(self) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("import_prefs", "Migrating preferences")
        prefs = _xrpc_get(self._old_sess.host, "app.bsky.actor.getPreferences",
                          headers=self._old_sess.auth_headers())
        _xrpc_post(
            self.new_pds_host,
            "app.bsky.actor.putPreferences",
            body={"preferences": prefs.get("preferences", [])},
            headers=self._new_sess.auth_headers(),
        )
        yield MigrationProgress("import_prefs", "Preferences imported")

    def _step_transfer_blobs(self) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("transfer_blobs", f"Counting blobs on {self._old_sess.host}")
        all_cids = self._list_all_blobs(self._old_sess)
        total = len(all_cids)
        self._all_blob_cids = all_cids

        if total == 0:
            yield MigrationProgress("transfer_blobs", "No blobs to transfer", skipped=True)
            return

        yield MigrationProgress("transfer_blobs", "Counting blobs already on new PDS")
        existing_cids = set(self._list_all_blobs(self._new_sess))
        pending_cids = [cid for cid in all_cids if cid not in existing_cids]
        already = total - len(pending_cids)

        yield MigrationProgress(
            "transfer_blobs",
            f"Found {total} blobs ({already} already on new PDS)",
            blob_done=already,
            blob_total=total,
        )

        if not pending_cids:
            yield MigrationProgress("transfer_blobs", "All blobs already transferred — skipping",
                                    blob_done=total, blob_total=total, skipped=True)
            return

        done = already
        for cid in pending_cids:
            blob_bytes = _xrpc_get_blob(self._old_sess, cid, self._did)
            try:
                _xrpc_post(
                    self.new_pds_host,
                    "com.atproto.repo.uploadBlob",
                    raw_body=blob_bytes,
                    content_type="*/*",
                    headers=self._new_sess.auth_headers(),
                    timeout=120,
                )
            except XRPCError as e:
                if e.code == "BlobAlreadyExists":
                    pass  # already uploaded — count it
                else:
                    # Log warning but continue — don't abort entire migration for one blob
                    yield MigrationProgress(
                        "transfer_blobs",
                        f"WARNING: failed to upload {cid}: {e.message}",
                        blob_done=done,
                        blob_total=total,
                    )
                    continue
            done += 1
            yield MigrationProgress(
                "transfer_blobs",
                f"blob {cid[:20]}… ({len(blob_bytes):,} bytes)",
                blob_done=done,
                blob_total=total,
            )

        yield MigrationProgress("transfer_blobs", f"Done — {done}/{total} blobs transferred",
                                blob_done=done, blob_total=total)

    def _step_update_identity(self, plc_token: str) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("update_identity", "Checking current DID document")

        # Check if DID doc already points to new PDS
        did_doc = _fetch_did_document(self._did)
        current_pds = _pds_from_did_doc(did_doc)
        if current_pds == self.new_pds_host:
            yield MigrationProgress("update_identity", "DID already points to new PDS — skipping", skipped=True)
            return

        yield MigrationProgress("update_identity", "Fetching recommended DID credentials from new PDS")
        creds = _xrpc_get(
            self.new_pds_host,
            "com.atproto.identity.getRecommendedDidCredentials",
            headers=self._new_sess.auth_headers(),
        )
        creds["token"] = plc_token

        yield MigrationProgress("update_identity", f"Signing PLC operation via {self._old_sess.host}")
        signed = _xrpc_post(
            self._old_sess.host,
            "com.atproto.identity.signPlcOperation",
            body=creds,
            headers=self._old_sess.auth_headers(),
        )

        yield MigrationProgress("update_identity", "Submitting PLC operation via new PDS")
        _xrpc_post(
            self.new_pds_host,
            "com.atproto.identity.submitPlcOperation",
            body={"operation": signed["operation"]},
            headers=self._new_sess.auth_headers(),
        )
        yield MigrationProgress("update_identity", "DID document updated")

    def _step_activate(self) -> Generator[MigrationProgress, None, None]:
        yield MigrationProgress("activate", "Activating account on new PDS")
        status = _check_account_status(self._new_sess)
        if status.get("activated"):
            yield MigrationProgress("activate", "Already activated — skipping", skipped=True)
            return
        _xrpc_post(
            self.new_pds_host,
            "com.atproto.server.activateAccount",
            headers=self._new_sess.auth_headers(),
        )
        yield MigrationProgress("activate", "Account activated")

    def _step_deactivate_old(self) -> Generator[MigrationProgress, None, None]:
        old_host = self._old_sess.host
        yield MigrationProgress("deactivate_old", f"Deactivating account on {old_host}")
        # Check old PDS status — if already deactivated, skip
        try:
            old_status = _check_account_status(self._old_sess)
            if not old_status.get("activated", True):
                yield MigrationProgress("deactivate_old", f"Already deactivated on {old_host} — skipping", skipped=True)
                return
        except XRPCError:
            pass  # If we can't check, try anyway

        _xrpc_post(
            old_host,
            "com.atproto.server.deactivateAccount",
            body={},
            headers=self._old_sess.auth_headers(),
        )
        yield MigrationProgress("deactivate_old", f"Account deactivated on {old_host}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _ensure_sessions(self):
        """Re-login if sessions have expired (called at start of finish())."""
        if self._old_sess is None or self._new_sess is None:
            raise RuntimeError("run() must be called before finish()")
        # Refresh old PDS session
        try:
            _xrpc_get(self._old_sess.host, "com.atproto.server.getSession",
                      headers=self._old_sess.auth_headers())
        except XRPCError:
            self._old_sess = _login(self._old_sess.host, self.old_handle, self.old_password)
        # Refresh new PDS session via admin (no temp password needed)
        try:
            _xrpc_get(self.new_pds_host, "com.atproto.server.getSession",
                      headers=self._new_sess.auth_headers())
        except XRPCError:
            self._new_sess = _admin_session(self.new_pds_host, self.new_pds_admin_password, self._did)

    def _list_all_blobs(self, sess: _Session) -> list[str]:
        cids = []
        cursor = ""
        while True:
            params = {"did": self._did, "limit": 100}
            if cursor:
                params["cursor"] = cursor
            resp = _xrpc_get(sess.host, "com.atproto.sync.listBlobs",
                             params=params, headers=sess.auth_headers())
            cids.extend(resp.get("cids", []))
            cursor = resp.get("cursor", "")
            if not cursor:
                break
        return cids


def _xrpc_get_blob(sess: _Session, cid: str, did: str) -> bytes:
    url = f"{sess.host.rstrip('/')}/xrpc/com.atproto.sync.getBlob"
    r = requests.get(url, params={"did": did, "cid": cid},
                     headers=sess.auth_headers(), timeout=120)
    _raise_for_xrpc(r)
    return r.content


def _discover_old_pds(handle: str) -> str:
    """Resolve a handle to its current atproto PDS host.

    Uses HTTPS well-known as primary, falls back to bsky.social's resolver
    (which uses DNS TXT records internally), then fetches the DID document.
    """
    did: Optional[str] = None
    try:
        r = requests.get(f"https://{handle}/.well-known/atproto-did", timeout=10)
        if r.ok:
            candidate = r.text.strip()
            if candidate.startswith("did:"):
                did = candidate
    except Exception:
        pass
    if did is None:
        resp = _xrpc_get(
            "https://bsky.social",
            "com.atproto.identity.resolveHandle",
            {"handle": handle},
        )
        did = resp["did"]
    doc = _fetch_did_document(did)
    pds_host = _pds_from_did_doc(doc)
    if not pds_host:
        raise ValueError(f"No atproto_pds service found in DID document for {did!r}")
    return pds_host


def _fetch_did_document(did: str) -> dict:
    """Fetch the DID document for a did:plc or did:web DID."""
    if did.startswith("did:plc:"):
        r = requests.get(f"https://plc.directory/{did}", timeout=10)
    elif did.startswith("did:web:"):
        authority = did[len("did:web:"):]
        r = requests.get(f"https://{authority}/.well-known/did.json", timeout=10)
    else:
        raise ValueError(f"Unsupported DID method: {did!r}")
    r.raise_for_status()
    return r.json()


def _pds_from_did_doc(doc: dict) -> str:
    """Extract the atproto_pds endpoint from a DID document.  Returns '' if not found."""
    # plc.directory format: {"services": {"atproto_pds": {"endpoint": "..."}}}
    endpoint = doc.get("services", {}).get("atproto_pds", {}).get("endpoint", "")
    if endpoint:
        return endpoint.rstrip("/")
    # W3C DID document format: {"service": [{"id": "#atproto_pds", "serviceEndpoint": "..."}]}
    for svc in doc.get("service", []):
        if svc.get("id") in ("#atproto_pds", "atproto_pds"):
            return svc.get("serviceEndpoint", "").rstrip("/")
    return ""


def _admin_session(host: str, admin_password: str, did: str) -> _Session:
    """Create a user session using admin credentials (no user password needed)."""
    url = f"{host.rstrip('/')}/xrpc/io.trustanchor.admin.createAccountSession"
    r = requests.post(
        url,
        json={"did": did},
        auth=("admin", admin_password),
        timeout=30,
    )
    _raise_for_xrpc(r)
    data = r.json()
    return _Session(
        host=host,
        did=did,
        access_jwt=data["accessJwt"],
        refresh_jwt=data["refreshJwt"],
    )


def _random_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))
