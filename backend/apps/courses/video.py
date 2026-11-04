"""Bunny Stream: lesson video uploads and protected playback.

Teachers upload straight from the browser to Bunny (resumable TUS upload), so large files never
pass through this server. We only keep Bunny's video ID on the lesson. Students get a short-lived
signed embed link, created only after the normal enrollment check.

Docs: https://bunny.net/docs/reference/tus-resumable-uploads
      https://bunny.net/docs/stream-embed-token-authentication
"""
import hashlib
import hmac
import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

API = "https://video.bunnycdn.com"
TUS_ENDPOINT = f"{API}/tusupload"
EMBED = "https://player.mediadelivery.net/embed"
UPLOAD_WINDOW_SECONDS = 6 * 60 * 60  # long enough to finish (or resume) a big upload on slow data

# Bunny's numeric video status -> ours. 0 = created but nothing uploaded yet.
_STATUS = {0: "UPLOADING", 1: "PROCESSING", 2: "PROCESSING", 3: "PROCESSING", 4: "READY",
           5: "FAILED", 6: "FAILED", 7: "PROCESSING", 8: "READY"}


class VideoServiceError(Exception):
    """Bunny could not be reached or refused the request."""


def is_configured() -> bool:
    return bool(settings.BUNNY_STREAM_LIBRARY_ID and settings.BUNNY_STREAM_API_KEY)


def _request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{API}/library/{settings.BUNNY_STREAM_LIBRARY_ID}/videos{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "AccessKey": settings.BUNNY_STREAM_API_KEY,
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            raw = res.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404 and method == "DELETE":
            return {}  # already gone
        logger.warning("Bunny Stream %s %s failed: %s", method, path, exc)
        raise VideoServiceError(f"Video service returned {exc.code}.") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Bunny Stream %s %s unreachable: %s", method, path, exc)
        raise VideoServiceError("Couldn't reach the video service. Try again in a moment.") from exc
    return json.loads(raw) if raw else {}


def create_video(title: str) -> str:
    """Create an empty video in the library and return its ID (GUID)."""
    return _request("POST", "", {"title": title[:200] or "Lesson video"})["guid"]


def upload_ticket(video_id: str) -> dict:
    """Everything the browser needs for a TUS upload. The API key itself never leaves the server."""
    library_id = str(settings.BUNNY_STREAM_LIBRARY_ID)
    expires = int(time.time()) + UPLOAD_WINDOW_SECONDS
    signature = hashlib.sha256(
        f"{library_id}{settings.BUNNY_STREAM_API_KEY}{expires}{video_id}".encode()
    ).hexdigest()
    return {
        "endpoint": TUS_ENDPOINT,
        "library_id": library_id,
        "video_id": video_id,
        "signature": signature,
        "expires": expires,
        "max_bytes": settings.VIDEO_MAX_UPLOAD_MB * 1024 * 1024,
    }


def fetch_status(video_id: str) -> tuple[str, int]:
    """(our status, length in seconds) straight from Bunny."""
    data = _request("GET", f"/{video_id}")
    return _STATUS.get(data.get("status"), "PROCESSING"), int(data.get("length") or 0)


def delete_video(video_id: str) -> None:
    """Best effort: a failed delete only leaves an unused file in the library."""
    if not (video_id and is_configured()):
        return
    try:
        _request("DELETE", f"/{video_id}")
    except VideoServiceError:
        logger.warning("Could not delete Bunny video %s; remove it from the library by hand.", video_id)


def embed_url(video_id: str) -> str:
    """Signed player link that stops working after VIDEO_PLAYBACK_TTL_SECONDS."""
    base = f"{EMBED}/{settings.BUNNY_STREAM_LIBRARY_ID}/{video_id}"
    params = "autoplay=false&preload=true&responsive=true"
    if not settings.BUNNY_STREAM_TOKEN_KEY:
        return f"{base}?{params}"  # library without token security: link is not protected
    expires = int(time.time()) + settings.VIDEO_PLAYBACK_TTL_SECONDS
    token = hashlib.sha256(f"{settings.BUNNY_STREAM_TOKEN_KEY}{video_id}{expires}".encode()).hexdigest()
    return f"{base}?token={token}&expires={expires}&{params}"


def valid_webhook_signature(raw_body: bytes, headers) -> bool:
    """Bunny signs webhooks with HMAC-SHA256 of the raw body, keyed by the read-only API key."""
    key = settings.BUNNY_STREAM_READONLY_API_KEY
    if not key:
        return True  # unsigned setup: the view re-checks the status with Bunny anyway
    if headers.get("X-BunnyStream-Signature-Version") != "v1":
        return False
    expected = hmac.new(key.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, headers.get("X-BunnyStream-Signature", "").lower())


_YOUTUBE = re.compile(r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/)([\w-]{11})")
_VIMEO = re.compile(r"vimeo\.com/(?:video/)?(\d+)(?:/([0-9a-f]+))?")


def playback(lesson) -> dict:
    """How the player should show a lesson's video: {"source": ..., "url": ...}.

    source is "BUNNY" / "YOUTUBE" / "VIMEO" (iframe players), "FILE" (a direct video file for
    <video>), or "" when there is nothing to play yet. Only call after the access check.
    """
    if lesson.video_id:
        if lesson.video_status != "READY":
            return {"source": "", "url": ""}
        return {"source": "BUNNY", "url": embed_url(lesson.video_id)}
    url = lesson.video_url
    if not url:
        return {"source": "", "url": ""}
    if match := _YOUTUBE.search(url):
        return {"source": "YOUTUBE", "url": f"https://www.youtube-nocookie.com/embed/{match.group(1)}?rel=0"}
    if match := _VIMEO.search(url):
        video, private_hash = match.groups()
        query = f"?h={private_hash}" if private_hash else ""
        if not private_hash and (h := urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("h")):
            query = f"?h={h[0]}"
        return {"source": "VIMEO", "url": f"https://player.vimeo.com/video/{video}{query}"}
    return {"source": "FILE", "url": url}


def youtube_embed_problem(url: str) -> str:
    """Why a YouTube link can't play inside Lop-rig, or "" if it can (or we can't tell right now).

    Uses YouTube's public oEmbed endpoint: 401 means the owner turned off embedding (common for
    music videos), 404/400/403 mean private, deleted or a broken link.
    """
    match = _YOUTUBE.search(url)
    if not match:
        return ""
    watch = urllib.parse.quote(f"https://www.youtube.com/watch?v={match.group(1)}", safe="")
    try:
        urllib.request.urlopen(f"https://www.youtube.com/oembed?format=json&url={watch}", timeout=6).close()
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            return ("The owner of this YouTube video doesn't allow it to play on other websites. "
                    "Choose another video, or upload the file instead.")
        if exc.code in (400, 403, 404):
            return "This YouTube video is private, deleted, or the link is incomplete."
    except (urllib.error.URLError, TimeoutError, OSError):
        pass  # YouTube unreachable: don't block the teacher over our own network trouble
    return ""
