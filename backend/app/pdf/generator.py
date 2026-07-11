"""Application PDF generator (ReportLab, Cyrillic + Kazakh via PT Sans).

Renders the service's docTemplate (with {{placeholders}}) into an official-
looking application form: requisites table, body, ЭЦП signature block
(spec Часть 3.6). PT Sans (ParaType) covers Kazakh glyphs; the tenge sign ₸
is spelled «тенге» since PT Sans lacks U+20B8.
"""

from __future__ import annotations

import io
import re
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

FONT_DIR = Path(__file__).resolve().parent / "fonts"
_REGISTERED = False


def _register_fonts() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    pdfmetrics.registerFont(TTFont("PTSans", str(FONT_DIR / "PTSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("PTSans-Bold", str(FONT_DIR / "PTSans-Bold.ttf")))
    pdfmetrics.registerFontFamily(
        "PTSans", normal="PTSans", bold="PTSans-Bold", italic="PTSans",
        boldItalic="PTSans-Bold",
    )
    _REGISTERED = True


def _group(n: float) -> str:
    sign = "-" if n < 0 else ""
    digits = f"{abs(int(round(n)))}"
    parts = []
    for i in range(len(digits), 0, -3):
        parts.insert(0, digits[max(0, i - 3):i])
    return sign + " ".join(parts)


def _fmt_value(v: object) -> str:
    if isinstance(v, bool):
        return "да" if v else "нет"
    if isinstance(v, (int, float)):
        return _group(v) if abs(v) >= 1000 else str(v)
    return "" if v is None else str(v)


def build_context(
    *,
    company: dict,
    answers: dict,
    calc: dict,
    app_number: str,
    app_date: str,
) -> dict[str, str]:
    ctx: dict[str, str] = {}
    for k, v in (answers or {}).items():
        ctx[f"answers.{k}"] = _fmt_value(v)
    for k, v in (calc or {}).items():
        ctx[f"calc.{k}"] = _fmt_value(v)
    ctx["company.name"] = company.get("name", "")
    ctx["company.bin"] = company.get("bin", "")
    ctx["company.director"] = company.get("director", "")
    ctx["company.address"] = company.get("address", "")
    ctx["company.region"] = company.get("region", "")
    ctx["app.number"] = app_number
    ctx["app.date"] = app_date
    return ctx


_PLACEHOLDER = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def substitute(template: str, ctx: dict[str, str]) -> str:
    return _PLACEHOLDER.sub(lambda m: ctx.get(m.group(1), f"[{m.group(1)}]"), template)


def render_application_pdf(
    *,
    app_number: str,
    app_date: str | None,
    service_title: str,
    org_name: str,
    company: dict,
    answers: dict,
    calc: dict,
    doc_template: str,
    signed_by: str | None = None,
) -> bytes:
    _register_fonts()
    app_date = app_date or datetime.now().strftime("%d.%m.%Y")

    body = ParagraphStyle("body", fontName="PTSans", fontSize=10.5, leading=15)
    right = ParagraphStyle("right", parent=body, alignment=TA_RIGHT)
    h1 = ParagraphStyle(
        "h1", fontName="PTSans-Bold", fontSize=15, leading=19, alignment=TA_CENTER,
        spaceBefore=6, spaceAfter=2,
    )
    sub = ParagraphStyle(
        "sub", parent=body, alignment=TA_CENTER, textColor=colors.HexColor("#5b6b7b"),
    )
    label = ParagraphStyle("label", fontName="PTSans", fontSize=9,
                           textColor=colors.HexColor("#5b6b7b"))
    small = ParagraphStyle("small", parent=body, fontSize=9,
                           textColor=colors.HexColor("#5b6b7b"))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Заявление {app_number}",
    )
    story: list = []

    story.append(Paragraph(org_name, right))
    story.append(Paragraph("Приложение к правилам предоставления услуги", right))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("ЗАЯВЛЕНИЕ", h1))
    story.append(Paragraph(service_title, sub))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(f"№ {app_number} от {app_date}", sub))
    story.append(Spacer(1, 7 * mm))

    # Requisites table
    req_rows = [
        ["Заявитель", company.get("name", "")],
        ["БИН / ИИН", company.get("bin", "")],
        ["Первый руководитель", company.get("director", "")],
        ["Регион", company.get("region", "")],
        ["Адрес", company.get("address", "")],
    ]
    table = Table(
        [[Paragraph(a, label), Paragraph(str(b), body)] for a, b in req_rows],
        colWidths=[45 * mm, None],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e5e8ec")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#e5e8ec")),
                ("INNERGRID", (0, 0), (0, -1), 0.4, colors.HexColor("#e5e8ec")),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 7 * mm))

    # Body from template
    ctx = build_context(
        company=company, answers=answers, calc=calc,
        app_number=app_number, app_date=app_date,
    )
    text = substitute(doc_template or "", ctx)
    for para in text.split("\n"):
        story.append(Paragraph(para.strip() or "&nbsp;", body))

    # Signature block
    story.append(Spacer(1, 12 * mm))
    sig = Table(
        [
            [
                Paragraph("Подписано электронной цифровой подписью (ЭЦП)", small),
                Paragraph(app_date, ParagraphStyle("r2", parent=small, alignment=TA_RIGHT)),
            ],
            [Paragraph(signed_by or company.get("director", ""), body), ""],
        ],
        colWidths=[None, 45 * mm],
    )
    sig.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 1), (0, 1), 0.6, colors.HexColor("#121517")),
                ("TOPPADDING", (0, 1), (0, 1), 4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(sig)

    doc.build(story)
    return buf.getvalue()


_MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_MD_BOLD = re.compile(r"\*\*([^*]+)\*\*")


def _md_inline(text: str) -> str:
    # Reduce markdown-lite inline syntax to plain text for the PDF — no
    # in-document navigation target, just the readable label.
    text = _MD_LINK.sub(r"\1", text)
    text = _MD_BOLD.sub(r"\1", text)
    return text


def render_knowledge_template_pdf(*, title: str, body: str) -> bytes:
    """Static downloadable template from the knowledge base (e.g. the
    business-plan structure) — same markdown-lite the frontend renders,
    no application-specific data or signature block."""
    _register_fonts()

    h1 = ParagraphStyle(
        "kh1", fontName="PTSans-Bold", fontSize=17, leading=21, alignment=TA_CENTER,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "kh2", fontName="PTSans-Bold", fontSize=12.5, leading=16,
        spaceBefore=10, spaceAfter=3, textColor=colors.HexColor("#121517"),
    )
    body_style = ParagraphStyle("kbody", fontName="PTSans", fontSize=10.5, leading=15, spaceAfter=4)
    bullet_style = ParagraphStyle(
        "kbullet", parent=body_style, leftIndent=10 * mm, bulletIndent=3 * mm,
    )
    code_style = ParagraphStyle(
        "kcode", fontName="PTSans", fontSize=9.5, leading=13,
        textColor=colors.HexColor("#3a4247"), backColor=colors.HexColor("#f2f4f5"),
        leftIndent=4 * mm, spaceBefore=2, spaceAfter=4,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=title,
    )
    story: list = [Paragraph(title, h1), Spacer(1, 4 * mm)]

    in_code = False
    for raw_line in body.splitlines():
        line = raw_line.rstrip()
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if not line.strip():
            continue
        if in_code:
            story.append(Paragraph(line.replace(" ", "&nbsp;"), code_style))
        elif line.startswith("## "):
            story.append(Paragraph(_md_inline(line[3:]), h2))
        elif line.startswith("- "):
            story.append(Paragraph(f"•&nbsp;&nbsp;{_md_inline(line[2:])}", bullet_style))
        else:
            story.append(Paragraph(_md_inline(line), body_style))

    doc.build(story)
    return buf.getvalue()
