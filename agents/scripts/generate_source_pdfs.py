"""Generate polished lease and manual PDFs from the markdown source registry."""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

from operio_agent.documents.source_registry import (
    LEASE_SOURCE_FILES,
    MANUAL_SOURCE_FILES,
    REPO_ROOT,
    SOURCE_ROOT,
)

TMP_OUTPUT_ROOT = REPO_ROOT / "tmp" / "pdfs"
FINAL_OUTPUT_ROOT = REPO_ROOT / "output" / "pdf"
PUBLIC_ASSET_ROOT = REPO_ROOT / "frontend" / "public" / "assets"
EXTRA_OUTPUT_ALIASES: dict[str, list[str]] = {
    "manuals/carrier-hvac.pdf": ["manuals/Carrier_Model-50TJ.pdf"],
}


def build_styles() -> StyleSheet1:
    """Build the typography system for generated source PDFs."""
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="OperioTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            textColor=colors.HexColor("#102033"),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioMeta",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#526070"),
            alignment=TA_CENTER,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioHeading2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#102033"),
            spaceBefore=10,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioHeading3",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#1f5f8b"),
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#223243"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioBullet",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            leftIndent=18,
            firstLineIndent=-10,
            bulletIndent=8,
            textColor=colors.HexColor("#223243"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioNumbered",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            leftIndent=18,
            firstLineIndent=-14,
            textColor=colors.HexColor("#223243"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OperioFooter",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#526070"),
            alignment=TA_RIGHT,
        )
    )
    return styles


def inline_markup(text: str) -> str:
    """Convert the limited markdown subset into reportlab Paragraph markup."""
    escaped = escape(text.strip())
    return re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", escaped)


def extract_title(markdown: str) -> str:
    """Return the first level-one heading as the document title."""
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return "Operio source document"


def markdown_to_story(markdown: str, styles: StyleSheet1) -> list:
    """Convert simplified source markdown into reportlab flowables."""
    story: list = []
    lines = markdown.splitlines()

    body_lines = lines[1:] if lines and lines[0].strip().startswith("# ") else lines
    paragraph_buffer: list[str] = []

    def flush_paragraph() -> None:
        if not paragraph_buffer:
            return
        text = " ".join(part.strip() for part in paragraph_buffer if part.strip())
        if text:
            story.append(Paragraph(inline_markup(text), styles["OperioBody"]))
        paragraph_buffer.clear()

    for raw_line in body_lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            flush_paragraph()
            continue

        if stripped == "---":
            flush_paragraph()
            story.append(Spacer(1, 4))
            story.append(
                HRFlowable(
                    width="100%",
                    thickness=0.8,
                    color=colors.HexColor("#cfd7df"),
                    spaceBefore=2,
                    spaceAfter=8,
                )
            )
            continue

        if stripped.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[3:]), styles["OperioHeading2"]))
            continue

        if stripped.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[4:]), styles["OperioHeading3"]))
            continue

        bullet_match = re.match(r"^\s*\*\s+(.*)$", line)
        if bullet_match:
            flush_paragraph()
            story.append(
                Paragraph(
                    inline_markup(bullet_match.group(1)),
                    styles["OperioBullet"],
                    bulletText="-",
                )
            )
            continue

        numbered_match = re.match(r"^\s*(\d+)\.\s+(.*)$", line)
        if numbered_match:
            flush_paragraph()
            story.append(
                Paragraph(
                    f"{numbered_match.group(1)}. {inline_markup(numbered_match.group(2))}",
                    styles["OperioNumbered"],
                )
            )
            continue

        paragraph_buffer.append(stripped)

    flush_paragraph()
    return story


def draw_page_chrome(canvas, _doc, footer_label: str) -> None:
    """Render the consistent page header and footer."""
    canvas.saveState()
    width, height = LETTER

    canvas.setStrokeColor(colors.HexColor("#d5dbe2"))
    canvas.setLineWidth(0.8)
    canvas.line(0.7 * inch, height - 0.8 * inch, width - 0.7 * inch, height - 0.8 * inch)

    canvas.setFillColor(colors.HexColor("#102033"))
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(0.7 * inch, height - 0.62 * inch, "OPERIO SOURCE LIBRARY")

    canvas.setFillColor(colors.HexColor("#526070"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - 0.7 * inch, height - 0.62 * inch, footer_label)
    canvas.drawRightString(width - 0.7 * inch, 0.55 * inch, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def build_pdf(markdown: str, target_path: Path, doc_label: str, source_id: str) -> None:
    """Create a polished PDF at the target path from markdown source text."""
    styles = build_styles()
    target_path.parent.mkdir(parents=True, exist_ok=True)

    title = extract_title(markdown)
    title_style = ParagraphStyle(
        "OperioTitleLocal",
        parent=styles["OperioTitle"],
        fontSize=20 if len(title) > 34 else 22,
        leading=25 if len(title) > 34 else 28,
    )
    document = SimpleDocTemplate(
        str(target_path),
        pagesize=LETTER,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=1.05 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="Operio",
        subject=f"{doc_label} source document",
    )

    story = [
        Paragraph(inline_markup(title), title_style),
        Paragraph(
            inline_markup(f"{doc_label} - {source_id} - Generated from Operio source markdown"),
            styles["OperioMeta"],
        ),
    ]
    story.extend(markdown_to_story(markdown, styles))

    footer_label = f"{doc_label} - {source_id}"
    document.build(
        story,
        onFirstPage=lambda canvas, doc: draw_page_chrome(canvas, doc, footer_label),
        onLaterPages=lambda canvas, doc: draw_page_chrome(canvas, doc, footer_label),
    )


def generate_collection(
    registry: dict[str, dict[str, str]],
    subdir: str,
    label: str,
) -> None:
    """Generate PDFs for one registry collection and copy them into final asset targets."""
    for source_id, meta in registry.items():
        markdown_path = SOURCE_ROOT / meta["file"]
        markdown = markdown_path.read_text(encoding="utf-8")
        filename = Path(meta["pdfUrl"]).name

        tmp_path = TMP_OUTPUT_ROOT / subdir / filename
        output_path = FINAL_OUTPUT_ROOT / subdir / filename
        public_path = PUBLIC_ASSET_ROOT / subdir / filename

        build_pdf(markdown, tmp_path, label, source_id)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        public_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(tmp_path, output_path)
        shutil.copyfile(tmp_path, public_path)
        relative_key = f"{subdir}/{filename}"
        for alias in EXTRA_OUTPUT_ALIASES.get(relative_key, []):
            alias_output_path = FINAL_OUTPUT_ROOT / alias
            alias_public_path = PUBLIC_ASSET_ROOT / alias
            alias_output_path.parent.mkdir(parents=True, exist_ok=True)
            alias_public_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(tmp_path, alias_output_path)
            shutil.copyfile(tmp_path, alias_public_path)
        print(f"Generated {public_path.relative_to(REPO_ROOT)}")


def main() -> None:
    """Generate all source PDFs used by the Operio evidence explorer."""
    generate_collection(LEASE_SOURCE_FILES, "leases", "Lease agreement")
    generate_collection(MANUAL_SOURCE_FILES, "manuals", "Equipment manual")


if __name__ == "__main__":
    main()
