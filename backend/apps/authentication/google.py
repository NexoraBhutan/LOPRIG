"""Sign in with Google: check the ID token the Google button gives the browser.

Google's tokeninfo endpoint verifies the token's signature and expiry for us; we then check that it
was issued for *our* client ID, by Google, for a verified email. No client secret is involved.
"""
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from rest_framework.exceptions import APIException, AuthenticationFailed

logger = logging.getLogger(__name__)

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
INVALID = "Google sign-in didn't work. Please try again."


class GoogleUnavailable(APIException):
    status_code = 503
    default_detail = "Sign in with Google isn't available right now. Please use your email and password."


def verify_id_token(credential: str) -> dict:
    """Returns Google's claims (email, name, picture, ...) for a valid token, or raises."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleUnavailable()
    url = f"{TOKENINFO_URL}?{urllib.parse.urlencode({'id_token': credential})}"
    try:
        with urllib.request.urlopen(url, timeout=10) as res:
            claims = json.load(res)
    except urllib.error.HTTPError:
        # 400 = expired, tampered with, or not a Google token.
        raise AuthenticationFailed(INVALID, code="google_token_invalid")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        logger.warning("Couldn't reach Google to verify a sign-in: %s", exc)
        raise GoogleUnavailable() from exc

    if (
        claims.get("aud") != settings.GOOGLE_CLIENT_ID
        or claims.get("iss") not in ISSUERS
        or str(claims.get("email_verified")).lower() != "true"
        or int(claims.get("exp", 0)) < time.time()
        or not claims.get("email")
    ):
        raise AuthenticationFailed(INVALID, code="google_token_invalid")
    return claims


def sized_picture(url: str, size: int = 256) -> str:
    """Google serves a 96px image by default ("...=s96-c"); ask for a sharper one."""
    if "googleusercontent.com" in url and "=s" in url:
        return url.rsplit("=s", 1)[0] + f"=s{size}-c"
    return url
