"""A one-page PDF payment receipt (invoice), attached to the student's "payment received" email.

Laid out on Lop-rig's letterhead: the logo top left, the national emblem top right, three faint
chevrons behind the text, and a yellow / orange / blue rule over the contact details at the foot.

Written with a tiny built-in PDF writer (standard Helvetica fonts, no extra packages), so it works the
same on every host. The two pictures sit in `receipt_assets/` already turned into PDF image data
(zlib-compressed RGB plus a separate alpha mask), so no image library is needed here either. Text
outside Latin-1 (e.g. Dzongkha) is shown as "?" in the PDF; the email itself shows it correctly.
"""
import json
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

PAGE_W, PAGE_H = 595, 842  # A4 in points
MARGIN = 50
ASSETS = Path(__file__).resolve().parent / "receipt_assets"

GOLD = (1.0, 0.714, 0.024)
INK = (0.102, 0.102, 0.102)
MUTED = (0.46, 0.46, 0.46)
LINE = (0.88, 0.88, 0.88)
# Letterhead colours: the logo's yellow, orange and blue, and pale tints of them for the chevrons.
BRAND_YELLOW = (1.0, 0.82, 0.0)
BRAND_ORANGE = (1.0, 0.36, 0.0)
BRAND_BLUE = (0.04, 0.25, 0.6)
TINT_YELLOW = (1.0, 0.965, 0.84)
TINT_ORANGE = (0.992, 0.918, 0.878)
TINT_OUTLINE = (0.84, 0.86, 0.9)
ICON = (0.22, 0.27, 0.35)
K = 0.5523  # Bezier handle length for drawing a circle with four curves


def _pdf_text(value: str) -> str:
    """Escape for a PDF string literal; characters Helvetica can't draw become '?'."""
    value = str(value).encode("latin-1", "replace").decode("latin-1")
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _width(text: str, size: float, bold: bool = False) -> float:
    """Rough Helvetica text width, good enough for aligning and wrapping."""
    return len(text) * size * (0.62 if bold else 0.5)


def _rgb(color, op):
    return f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} {op}"


@cache
def _picture(name: str) -> dict | None:
    """One letterhead picture as PDF image data, or None if its files are missing."""
    try:
        size = json.loads((ASSETS / "manifest.json").read_text())[name]
        return {**size, "rgb": (ASSETS / f"{name}.rgb.z").read_bytes(),
                "alpha": (ASSETS / f"{name}.alpha.z").read_bytes()}
    except (OSError, KeyError, ValueError):
        return None


@dataclass
class _Page:
    ops: list[str] = field(default_factory=list)
    pictures: list[str] = field(default_factory=list)

    def rect(self, x, y, w, h, color):
        self.ops.append(f"{_rgb(color, 'rg')} {x} {y} {w} {h} re f")

    def line(self, x1, y, x2, color=LINE, width=1):
        self.ops.append(f"{_rgb(color, 'RG')} {width} w {x1} {y} m {x2} {y} l S")

    def text(self, x, y, value, size=10, bold=False, color=INK, align="left"):
        if align == "right":
            x -= _width(str(value), size, bold)
        elif align == "center":
            x -= _width(str(value), size, bold) / 2
        font = "F2" if bold else "F1"
        self.ops.append(
            f"BT {_rgb(color, 'rg')} /{font} {size} Tf {x:.1f} {y:.1f} Td ({_pdf_text(value)}) Tj ET"
        )

    def wrapped(self, x, y, value, max_width, size=10, bold=False, color=INK, leading=None) -> float:
        """Draw text over several lines; returns the y below the last line."""
        leading = leading or size * 1.4
        line = ""
        for word in str(value).split():
            trial = f"{line} {word}".strip()
            if line and _width(trial, size, bold) > max_width:
                self.text(x, y, line, size, bold, color)
                y -= leading
                line = word
            else:
                line = trial
        if line:
            self.text(x, y, line, size, bold, color)
            y -= leading
        return y

    def picture(self, name, x, y, height=None, width=None) -> float:
        """Draw a letterhead picture with its bottom-left corner at (x, y); returns its width."""
        pic = _picture(name)
        if not pic:
            return 0
        if width is None:
            width = height * pic["width"] / pic["height"]
        height = width * pic["height"] / pic["width"]
        if name not in self.pictures:
            self.pictures.append(name)
        self.ops.append(f"q {width:.2f} 0 0 {height:.2f} {x:.2f} {y:.2f} cm /Im{name} Do Q")
        return width

    def chevron(self, x, top, w, h, arm, fill=None, outline=None):
        """A ">" shape in the box whose top-left corner is (x, top), with rounded corners."""
        y0, mid, y1 = top, top - h / 2, top - h
        points = [(x, y0), (x + arm, y0), (x + w, mid), (x + arm, y1), (x, y1), (x + w - arm, mid)]
        path = f"{points[0][0]:.1f} {points[0][1]:.1f} m " + " ".join(f"{px:.1f} {py:.1f} l" for px, py in points[1:])
        if fill:
            # Stroking in the same colour with round joins softens the corners, as in the letterhead.
            self.ops.append(f"q 1 J 1 j 14 w {_rgb(fill, 'rg')} {_rgb(fill, 'RG')} {path} h B Q")
        if outline:
            self.ops.append(f"q 1 J 1 j 1.1 w {_rgb(outline, 'RG')} {path} h S Q")

    def _ellipse(self, cx, cy, rx, ry) -> str:
        kx, ky = rx * K, ry * K
        return (f"{cx + rx:.2f} {cy:.2f} m "
                f"{cx + rx:.2f} {cy + ky:.2f} {cx + kx:.2f} {cy + ry:.2f} {cx:.2f} {cy + ry:.2f} c "
                f"{cx - kx:.2f} {cy + ry:.2f} {cx - rx:.2f} {cy + ky:.2f} {cx - rx:.2f} {cy:.2f} c "
                f"{cx - rx:.2f} {cy - ky:.2f} {cx - kx:.2f} {cy - ry:.2f} {cx:.2f} {cy - ry:.2f} c "
                f"{cx + kx:.2f} {cy - ry:.2f} {cx + rx:.2f} {cy - ky:.2f} {cx + rx:.2f} {cy:.2f} c S")

    def icon(self, kind, cx, cy):
        """A small line icon (globe, envelope or phone) centred on (cx, cy)."""
        ops = [f"q {_rgb(ICON, 'RG')} 0.9 w 1 J 1 j"]
        if kind == "web":
            ops += [self._ellipse(cx, cy, 5.5, 5.5), self._ellipse(cx, cy, 2.4, 5.5),
                    f"{cx - 5.5:.2f} {cy:.2f} m {cx + 5.5:.2f} {cy:.2f} l S"]
        elif kind == "email":
            ops += [f"{cx - 6:.2f} {cy - 4:.2f} 12 8 re S",
                    f"{cx - 6:.2f} {cy + 4:.2f} m {cx:.2f} {cy - 0.5:.2f} l {cx + 6:.2f} {cy + 4:.2f} l S"]
        else:  # phone
            ops += [f"{cx - 3.6:.2f} {cy - 6:.2f} 7.2 12 re S",
                    f"{cx - 1.2:.2f} {cy - 4.2:.2f} m {cx + 1.2:.2f} {cy - 4.2:.2f} l S"]
        ops.append("Q")
        self.ops.append(" ".join(ops))


def _assemble(content: str, pictures: list[str]) -> bytes:
    """Write the PDF: catalog, page, content stream, two fonts, then each picture and its alpha mask."""
    first_picture = 7
    xobjects = " ".join(f"/Im{name} {first_picture + 2 * i} 0 R" for i, name in enumerate(pictures))
    objects: list[tuple[str, bytes | None]] = [
        ("<< /Type /Catalog /Pages 2 0 R >>", None),
        ("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", None),
        (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
         f"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << {xobjects} >> >> /Contents 4 0 R >>", None),
        ("<<", content.encode("latin-1")),
        ("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", None),
        ("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", None),
    ]
    for i, name in enumerate(pictures):
        pic = _picture(name)
        size = f"/Width {pic['width']} /Height {pic['height']} /BitsPerComponent 8 /Filter /FlateDecode"
        mask = first_picture + 2 * i + 1
        objects.append((f"<< /Type /XObject /Subtype /Image {size} /ColorSpace /DeviceRGB /SMask {mask} 0 R", pic["rgb"]))
        objects.append((f"<< /Type /XObject /Subtype /Image {size} /ColorSpace /DeviceGray", pic["alpha"]))

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for number, (body, stream) in enumerate(objects, start=1):
        offsets.append(len(out))
        if stream is None:
            out += f"{number} 0 obj\n{body}\nendobj\n".encode("latin-1")
        else:
            out += f"{number} 0 obj\n{body} /Length {len(stream)} >>\nstream\n".encode("latin-1")
            out += stream + b"\nendstream\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def _letterhead(p: _Page, contact: list[tuple[str, str]], emblem: bool):
    """Chevrons behind everything, logo and emblem on top, coloured rule and contacts at the foot."""
    right = PAGE_W - MARGIN
    p.chevron(124, PAGE_H - 160, 160, 196, 62, fill=TINT_YELLOW)
    p.chevron(190, PAGE_H - 298, 186, 222, 70, outline=TINT_OUTLINE)
    p.chevron(300, PAGE_H - 450, 176, 210, 66, fill=TINT_ORANGE)

    p.picture("logo", MARGIN, PAGE_H - 92, height=48)
    if emblem:
        p.picture("emblem", right - 64, PAGE_H - 102, width=64)

    third = (right - MARGIN) / 3
    for i, color in enumerate((BRAND_YELLOW, BRAND_ORANGE, BRAND_BLUE)):
        p.rect(MARGIN + i * third, 74, third, 3, color)
    columns = [c for c in contact if c[1]]
    if columns:
        width = (right - MARGIN) / len(columns)
        for i, (kind, value) in enumerate(columns):
            cx = MARGIN + width * (i + 0.5)
            p.icon(kind, cx, 56)
            p.text(cx, 36, value, 8, False, INK, "center")


def build_receipt_pdf(*, number: str, issued: str, student: tuple[str, str], payee: tuple[str, str],
                      items: list[tuple[str, str]], payment: list[tuple[str, str]], amount: str,
                      status: str, test_mode: bool = False, contact: list[tuple[str, str]] | None = None,
                      emblem: bool = True) -> bytes:
    """`items` describe the enrollment (course, category, ...); `payment` how it was paid.

    `contact` lists the letterhead's foot as ("web" | "email" | "phone", value); empty values are left out.
    """
    p = _Page()
    right = PAGE_W - MARGIN
    _letterhead(p, contact or [], emblem)

    # Title
    y = PAGE_H - 140
    p.text(MARGIN, y, "PAYMENT RECEIPT", 18, True)
    p.rect(MARGIN, y - 10, 46, 3, GOLD)
    p.text(right, y + 4, "RECEIPT NO.", 7, True, MUTED, "right")
    p.text(right, y - 9, number, 10, True, INK, "right")
    p.text(right, y - 24, f"Issued {issued}", 9, False, MUTED, "right")
    y -= 56

    if test_mode:
        p.rect(MARGIN, y - 14, right - MARGIN, 26, (1.0, 0.93, 0.93))
        p.text(MARGIN + 10, y - 5, "TEST RECEIPT - the bank gateway is not connected yet, so no money was taken.",
               9, True, (0.7, 0.1, 0.1))
        y -= 40

    # Billed to / Paid to
    half = (right - MARGIN) / 2
    p.text(MARGIN, y, "BILLED TO", 8, True, MUTED)
    p.text(MARGIN + half, y, "PAID TO", 8, True, MUTED)
    y -= 16
    p.text(MARGIN, y, student[0], 11, True)
    p.text(MARGIN + half, y, payee[0], 11, True)
    y -= 14
    p.text(MARGIN, y, student[1], 9, False, MUTED)
    p.text(MARGIN + half, y, payee[1], 9, False, MUTED)
    y -= 34

    def section(title, rows, y):
        p.text(MARGIN, y, title, 8, True, MUTED)
        y -= 8
        p.line(MARGIN, y, right)
        y -= 18
        for label, value in rows:
            p.text(MARGIN, y, label, 10, False, MUTED)
            y = p.wrapped(MARGIN + 150, y, value or "-", right - MARGIN - 150, 10, True) - 4
        return y - 14

    y = section("ENROLLMENT", items, y)
    y = section("PAYMENT", payment, y)

    # Total
    p.rect(MARGIN, y - 30, right - MARGIN, 44, (1.0, 0.965, 0.88))
    p.text(MARGIN + 14, y - 13, "Total paid", 12, True)
    p.text(right - 14, y - 13, amount, 16, True, INK, "right")
    y -= 58
    p.text(MARGIN, y, f"Status: {status}", 10, True, (0.02, 0.47, 0.34))

    p.wrapped(MARGIN, 104, "Thank you for learning with Lop-rig. Keep this receipt for your records. "
              "Questions about this payment? Reply to the email it came with.", right - MARGIN, 8, False, MUTED)
    return _assemble("\n".join(p.ops), p.pictures)
