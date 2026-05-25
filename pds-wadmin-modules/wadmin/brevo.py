"""
Brevo email integration for invitation system.

Handles sending invitation emails via Brevo's Transactional Email API
and managing contact lists.
"""

import base64
import time
from typing import Optional, Dict, List

try:
    import requests
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
except ImportError as e:
    raise ImportError(
        f"Brevo SDK not installed: {e}\n"
        "Install with: pip install sib-api-v3-sdk requests"
    )


# Brevo List IDs
BREVO_WAITLIST_LIST_ID = 23     # Users who signed up for early access
BREVO_INVITED_LIST_ID = 24      # Invitation sent, waiting to start onboarding
BREVO_STARTED_LIST_ID = 25      # Started onboarding (email+password form opened), not yet done
BREVO_REGISTERED_LIST_ID = 26   # Account created with email+password
BREVO_ONBOARDED_LIST_ID = 27    # Completed first login via W Identity


def fetch_and_encode_qr_code(qr_code_url: str, timeout: int = 10) -> Optional[str]:
    """
    Fetch QR code image from URL and return as base64 data URI.

    Args:
        qr_code_url: URL to QR code image (typically from Neuro)
        timeout: HTTP request timeout in seconds

    Returns:
        Base64 data URI (data:image/png;base64,...) or None if fetch fails
    """
    try:
        response = requests.get(qr_code_url, timeout=timeout)
        response.raise_for_status()

        # Determine content type from response
        content_type = response.headers.get('Content-Type', 'image/png')

        # Encode image as base64
        image_data = base64.b64encode(response.content).decode('utf-8')

        # Return as data URI
        return f"data:{content_type};base64,{image_data}"

    except Exception:
        # Silently fail - email will still work with hosted URL
        return None


def send_invitation_email_with_params(
    api_key: str,
    template_id: int,
    email: str,
    params: dict,
    from_email: str = "invitations@wsocial.app",
    from_name: str = "W Social Team",
    max_retries: int = 3,
) -> Dict:
    """
    Send a Brevo transactional email with a pre-built params dict.

    Use this directly when you control the params yourself (e.g. the pass
    invitation flow, which only needs ONBOARDING_URL). For the standard WID
    invitation flow, use send_invitation_email which builds the params for you.

    Returns:
        dict with keys: success (bool), message_id (str), from_email (str),
        from_name (str), error (str)
    """
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = api_key
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
        sib_api_v3_sdk.ApiClient(configuration)
    )

    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": email}],
        template_id=template_id,
        params=params,
        sender={"email": from_email, "name": from_name},
    )

    last_error = None
    for attempt in range(max_retries):
        try:
            response = api_instance.send_transac_email(send_smtp_email)
            return {
                "success": True,
                "message_id": response.message_id,
                "from_email": from_email,
                "from_name": from_name,
                "error": None,
            }

        except ApiException as e:
            import json
            try:
                error_data = json.loads(e.body)
                error_message = error_data.get('message', str(e))
            except Exception:
                error_message = str(e)

            last_error = error_message

            if e.status >= 500 or e.status == 429:
                if attempt < max_retries - 1:
                    sleep_time = 2 ** attempt
                    time.sleep(sleep_time)
                    continue

            break

        except Exception as e:
            last_error = str(e)
            break

    return {
        "success": False,
        "message_id": None,
        "error": last_error or "Unknown error",
    }


def send_invitation_email(
    api_key: str,
    template_id: int,
    email: str,
    onboarding_url: str,
    qr_code_url: str,
    preferred_handle: Optional[str] = None,
    from_email: str = "invitations@wsocial.app",
    from_name: str = "W Social Team",
    max_retries: int = 3,
    inline_qr_code: Optional[str] = None,
) -> Dict:
    """
    Build the standard WID invitation email params, then send via Brevo.

    Fetches and inlines the QR code image, includes PREFERRED_HANDLE if
    provided. For templates that need different params (e.g. pass invitations
    with only ONBOARDING_URL), call send_invitation_email_with_params directly.

    Returns:
        dict with keys: success (bool), message_id (str), from_email (str),
        from_name (str), error (str)
    """
    # Use caller-supplied inline QR, or fetch from URL
    if inline_qr_code is None:
        inline_qr_code = fetch_and_encode_qr_code(qr_code_url)

    params: dict = {
        "ONBOARDING_URL": onboarding_url,
        "QR_CODE_URL": qr_code_url,
    }
    if inline_qr_code:
        params["INLINE_QR_CODE"] = inline_qr_code
    if preferred_handle:
        params["PREFERRED_HANDLE"] = preferred_handle

    return send_invitation_email_with_params(
        api_key=api_key,
        template_id=template_id,
        email=email,
        params=params,
        from_email=from_email,
        from_name=from_name,
        max_retries=max_retries,
    )


def get_list_contacts(
    api_key: str,
    list_id: int,
    limit: int = 500,
    offset: int = 0
) -> Dict:
    """
    Fetch contacts from a Brevo list.

    Args:
        api_key: Brevo API key
        list_id: Brevo list ID
        limit: Maximum number of contacts to fetch (max 500)
        offset: Pagination offset

    Returns:
        dict with keys: contacts (list), count (int), error (str)
    """
    try:
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        api_instance = sib_api_v3_sdk.ContactsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        # Fetch contacts from list
        contacts_list = api_instance.get_contacts_from_list(
            list_id=list_id,
            limit=min(limit, 500),  # API max is 500
            offset=offset
        )

        # Convert contact objects to dicts
        # The SDK returns Contact objects with .email and .id attributes
        contacts = []
        if hasattr(contacts_list, 'contacts') and contacts_list.contacts:
            for c in contacts_list.contacts:
                if hasattr(c, 'email'):
                    contacts.append({"email": c.email, "id": c.id if hasattr(c, 'id') else None})
                elif isinstance(c, dict):
                    contacts.append({"email": c.get("email"), "id": c.get("id")})

        return {
            "success": True,
            "contacts": contacts,
            "count": contacts_list.count if hasattr(contacts_list, 'count') else len(contacts),
            "error": None,
        }

    except ApiException as e:
        return {
            "success": False,
            "contacts": [],
            "count": 0,
            "error": str(e),
        }
    except Exception as e:
        return {
            "success": False,
            "contacts": [],
            "count": 0,
            "error": str(e),
        }


def get_list_count(api_key: str, list_id: int) -> Dict:
    """
    Get contact count for a Brevo list.

    Args:
        api_key: Brevo API key
        list_id: Brevo list ID

    Returns:
        dict with keys: count (int), name (str), error (str)
    """
    try:
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        api_instance = sib_api_v3_sdk.ContactsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        # Get list details
        list_info = api_instance.get_list(list_id)

        return {
            "success": True,
            "count": list_info.total_subscribers,
            "name": list_info.name,
            "error": None,
        }

    except ApiException as e:
        return {
            "success": False,
            "count": 0,
            "name": None,
            "error": str(e),
        }
    except Exception as e:
        return {
            "success": False,
            "count": 0,
            "name": None,
            "error": str(e),
        }


def add_contact_to_list(
    api_key: str,
    email: str,
    list_id: int,
) -> Dict:
    """
    Ensure a contact exists in Brevo and add them to a list.

    Creates the contact if they don't exist yet (idempotent). Safe to call
    multiple times — calling again when already in the list is a no-op.

    Args:
        api_key: Brevo API key
        email: Contact email address
        list_id: Brevo list ID to add the contact to

    Returns:
        dict with keys: success (bool), error (str)
    """
    try:
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        api_instance = sib_api_v3_sdk.ContactsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        # CreateContact with update_enabled=True is idempotent: creates if new,
        # updates (no-op) if existing, and always applies list_ids.
        create_contact = sib_api_v3_sdk.CreateContact(
            email=email,
            list_ids=[list_id],
            update_enabled=True,
        )
        api_instance.create_contact(create_contact)

        return {"success": True, "error": None}

    except ApiException as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def move_contact_between_lists(
    api_key: str,
    email: str,
    from_list_id: int,
    to_list_id: int
) -> Dict:
    """
    Move a contact from one Brevo list to another.

    Args:
        api_key: Brevo API key
        email: Contact email address
        from_list_id: Source list ID
        to_list_id: Destination list ID

    Returns:
        dict with keys: success (bool), error (str)
    """
    try:
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        api_instance = sib_api_v3_sdk.ContactsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        # Remove from source list
        remove_body = sib_api_v3_sdk.RemoveContactFromList(emails=[email])
        api_instance.remove_contact_from_list(from_list_id, remove_body)

        # Add to destination list
        add_body = sib_api_v3_sdk.AddContactToList(emails=[email])
        api_instance.add_contact_to_list(to_list_id, add_body)

        return {
            "success": True,
            "error": None,
        }

    except ApiException as e:
        return {
            "success": False,
            "error": str(e),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }
