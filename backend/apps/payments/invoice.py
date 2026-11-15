"""A one-page PDF payment receipt (invoice), attached to the student's "payment received" email.

Written with a tiny built-in PDF writer (standard Helvetica fonts, no extra packages), so it works the
same on every host. Text outside Latin-1 (e.g. Dzongkha) is shown as "?" in the PDF; the email itself
shows it correctly.
"""
from dataclasses import dataclass, field

PAGE_W, PAGE_H = 595, 842  # A4 in points
MARGIN = 50

GOLD = (1.0, 0.714, 0.024)
INK = (0.102, 0.102, 0.102)
MUTED = (0.46, 0.46, 0.46)
LINE = (0.88, 0.88, 0.88)


def _pdf_text(value: str) -> str:
    """Escape for a PDF string literal; characters Helvetica can't draw become '?'."""
    value = str(value).encode("latin-1", "replace").decode("latin-1")
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _width(text: str, size: float, bold: bool = False) -> float:
    """Rough Helvetica text width, good enough for right-aligning and wrapping."""
    return len(text) * size * (0.56 if bold else 0.5)


@dataclass
class _Page:
    ops: list[str] = field(default_factory=list)

    def rect(self, x, y, w, h, color):
        self.ops.append(f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg {x} {y} {w} {h} re f")

    def line(self, x1, y, x2, color=LINE, width=1):
        self.ops.append(f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} RG {width} w {x1} {y} m {x2} {y} l S")

    def text(self, x, y, value, size=10, bold=False, color=INK, align="left"):
        if align == "right":
            x -= _width(str(value), size, bold)
        font = "F2" if bold else "F1"
        self.ops.append(
            f"BT {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg /{font} {size} Tf {x:.1f} {y:.1f} Td "
            f"({_pdf_text(value)}) Tj ET"
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


def _assemble(content: str) -> bytes:
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
        "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
        None,  # content stream
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]
    stream = content.encode("latin-1")
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        if body is None:
            out += f"{number} 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream\nendobj\n"
        else:
            out += f"{number} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def build_receipt_pdf(*, number: str, issued: str, student: tuple[str, str], payee: tuple[str, str],
                      items: list[tuple[str, str]], payment: list[tuple[str, str]], amount: str,
                      status: str, test_mode: bool = False) -> bytes:
    """`items` describe the enrollment (course, category, ...); `payment` how it was paid."""
    p = _Page()
    right = PAGE_W - MARGIN

    # Header band
    p.rect(0, PAGE_H - 110, PAGE_W, 110, INK)
    p.rect(0, PAGE_H - 116, PAGE_W, 6, GOLD)
    p.text(MARGIN, PAGE_H - 58, "Lop-rig", 26, True, (1, 1, 1))
    p.text(MARGIN, PAGE_H - 80, "Learn. Grow. Build your future.", 10, False, (0.8, 0.8, 0.8))
    p.text(right, PAGE_H - 55, "PAYMENT RECEIPT", 16, True, GOLD, "right")
    p.text(right, PAGE_H - 75, f"No. {number}", 10, False, (1, 1, 1), "right")
    p.text(right, PAGE_H - 90, f"Issued {issued}", 9, False, (0.8, 0.8, 0.8), "right")

    y = PAGE_H - 150
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
    y -= 40

    p.line(MARGIN, 90, right)
    p.wrapped(MARGIN, 72, "Thank you for learning with Lop-rig. Keep this receipt for your records. "
              "Questions about this payment? Reply to the email it came with.", right - MARGIN, 8, False, MUTED)
    return _assemble("\n".join(p.ops))
