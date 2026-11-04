"""Small, dependency-free checks for uploaded images (payment screenshots, the bank QR)."""
from django.conf import settings
from rest_framework.exceptions import ValidationError

# File signatures: trust the bytes, not the file name or the browser's content type.
_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpg",
}


def image_kind(head: bytes) -> str | None:
    for signature, kind in _SIGNATURES.items():
        if head.startswith(signature):
            return kind
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def check_image(upload, field: str, max_mb: int | None = None):
    """Accept PNG, JPEG or WebP under the size limit. Returns the upload, renamed by its real type."""
    max_mb = max_mb or settings.PAYMENT_PROOF_MAX_MB
    if upload.size > max_mb * 1024 * 1024:
        raise ValidationError({field: f"The image is too large. The limit is {max_mb} MB."})
    head = upload.read(16)
    upload.seek(0)
    kind = image_kind(head)
    if kind is None:
        raise ValidationError({field: "Upload a screenshot or photo (PNG, JPG or WebP)."})
    upload.name = f"upload.{kind}"
    return upload
