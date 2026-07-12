from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urlencode, urljoin


@dataclass
class BgovCard:
    url: str
    code: str
    title: str
    org_code: str | None
    org_name: str
    category: str
    summary: str
    text: str
    description: str
    conditions: list[dict]
    evidence: list[dict]
    materials: list[dict]
    raw: dict


class _DataPageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.data_page: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "div":
            return
        values = dict(attrs)
        if values.get("id") == "app" and values.get("data-page"):
            self.data_page = values["data-page"]


def parse_data_page(html_text: str) -> dict:
    parser = _DataPageParser()
    parser.feed(html_text)
    if not parser.data_page:
        match = re.search(r'<div[^>]+id=["\']app["\'][^>]+data-page=["\'](.+?)["\']', html_text, re.S)
        if not match:
            raise ValueError("bgov.kz response has no Inertia data-page")
        parser.data_page = match.group(1)
    return json.loads(html.unescape(parser.data_page))


def services_url(base_url: str, page: int = 1) -> str:
    url = urljoin(base_url.rstrip("/") + "/", "ru/services")
    if page > 1:
        return f"{url}?{urlencode({'page': page})}"
    return url


def detail_url(base_url: str, code: str) -> str:
    return urljoin(base_url.rstrip("/") + "/", f"ru/services/{code}")


def cards_from_page(payload: dict, base_url: str) -> tuple[list[BgovCard], int]:
    props = payload.get("props") or {}
    services = props.get("services") or props.get("models") or props.get("items") or {}
    rows = services.get("data") if isinstance(services, dict) else services
    if not isinstance(rows, list):
        rows = []
    last_page = int(services.get("last_page") or 1) if isinstance(services, dict) else 1
    return [normalize_card(row, base_url) for row in rows if isinstance(row, dict)], last_page


def normalize_card(row: dict, base_url: str) -> BgovCard:
    title = clean_text(row.get("name") or row.get("title") or row.get("form", {}).get("name") or "Без названия")
    code = str(row.get("code") or row.get("slug") or row.get("id") or "")
    url = detail_url(base_url, code) if code else services_url(base_url)
    team = row.get("team") if isinstance(row.get("team"), dict) else {}
    category_obj = row.get("primary_category") if isinstance(row.get("primary_category"), dict) else {}
    category = normalize_category(category_obj.get("code") or category_obj.get("name") or "")
    blocks = editor_text(row.get("content"))
    requirements = requirement_text(row.get("requirements"))
    # `description` is often an HTML *table* (see structured_description()),
    # not prose — clean_text() would flatten it into one run-on wall of text
    # with no sentence boundaries to split on. Prefer an actual short
    # sentence; hard-cap anything longer instead of dumping the whole table.
    summary = clean_text(row.get("short_description") or "") or first_sentence(blocks)
    if not summary:
        summary = clean_text(row.get("description") or "")
    if len(summary) > 220:
        summary = first_sentence(summary)
        if len(summary) > 220:
            summary = summary[:200].rstrip() + "…"
    conditions = structured_conditions(row.get("conditions"))
    # bgov publishes the real program text as Editor.js blocks (Участники,
    # Целевое назначение, Встречные обязательства, ...) — use that verbatim
    # instead of AI-guessing a summary, so the service page shows the actual
    # published sections.
    description = structured_description(row.get("content")) or blocks or summary
    # Документы идут первым блоком (сверху), затем условия.
    evidence = extract_document_evidence(requirements, blocks) + evidence_from_conditions(conditions)
    text = "\n\n".join(
        part
        for part in [
            f"Название: {title}",
            f"Оператор: {team.get('short_name') or team.get('name') or ''}",
            f"Категория: {category_obj.get('name') or category}",
            summary,
            blocks,
            requirements,
        ]
        if part
    )
    return BgovCard(
        url=url,
        code=code,
        title=title,
        org_code=team.get("code"),
        org_name=clean_text(team.get("short_name") or team.get("name") or ""),
        category=category,
        summary=summary,
        text=text,
        description=description,
        conditions=conditions,
        evidence=evidence,
        materials=[],
        raw=row,
    )


def editor_text(value) -> str:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return clean_text(value)
    if not isinstance(value, dict):
        return ""
    lines: list[str] = []
    for block in value.get("blocks") or []:
        if not isinstance(block, dict):
            continue
        data = block.get("data") if isinstance(block.get("data"), dict) else {}
        text = data.get("text") or ""
        if text:
            lines.append(clean_text(text))
    return "\n".join(line for line in lines if line)


def requirement_text(value) -> str:
    if not isinstance(value, list):
        return ""
    lines = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = clean_text(item.get("name") or "")
        placeholder = clean_text(item.get("placeholder") or "")
        if name and placeholder:
            lines.append(f"{name}: {placeholder}")
        elif name:
            lines.append(name)
    return "\n".join(lines)


CONDITION_KIND = {"amount": "amount", "period": "term", "percent": "rate"}


def structured_conditions(value) -> list[dict]:
    """bgov publishes exact min/max/unit per condition — use it verbatim
    instead of guessing numbers out of free text with regex."""
    if not isinstance(value, list):
        return []
    out: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = clean_text(item.get("title") or item.get("code") or "")
        formatted = format_condition_value(item)
        if label and formatted:
            out.append({"label": label, "value": formatted, "code": item.get("code") or ""})
    return out


def format_condition_value(item: dict) -> str:
    unit = clean_text(item.get("unit") or "")
    lo, hi = item.get("min"), item.get("max")

    def fmt(n) -> str:
        if isinstance(n, float) and n.is_integer():
            n = int(n)
        if isinstance(n, int):
            return f"{n:,}".replace(",", " ")
        return str(n)

    if lo is not None and hi is not None:
        return f"{fmt(lo)}–{fmt(hi)} {unit}".strip()
    if hi is not None:
        return f"до {fmt(hi)} {unit}".strip()
    if lo is not None:
        return f"от {fmt(lo)} {unit}".strip()
    return ""


def evidence_from_conditions(conditions: list[dict]) -> list[dict]:
    return [
        {
            "kind": CONDITION_KIND.get(item.get("code", ""), "condition"),
            "label": item["label"],
            "value": item["value"],
            "sourceQuote": f"{item['label']}: {item['value']}",
            "mappedTo": "draftPayload.card.conditions",
            # Structured source data, not regex-guessed — high confidence.
            "confidence": 0.97,
        }
        for item in conditions
    ]


def extract_document_evidence(requirements: str, text: str) -> list[dict]:
    haystack = "\n".join([requirements, text])
    match = re.search(r"((?:документ|справк|заявлен)[^.\n]{0,140})", haystack, flags=re.I)
    if not match:
        return []
    quote = clean_text(match.group(1))
    return [
        {
            "kind": "document",
            "label": "Документы",
            "value": quote[:80],
            "sourceQuote": quote[:240],
            "mappedTo": "draftPayload.card.documents",
            "confidence": 0.72,
        }
    ]


def structured_description(value) -> str:
    """Render Editor.js blocks as the section-labelled plain text the source
    actually published (Участники / Целевое назначение / Встречные
    обязательства / ...), instead of collapsing everything into one
    paragraph. The frontend renders `description` as plain text split on
    newlines, so this stays free of HTML."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return clean_text(value)
    if not isinstance(value, dict):
        return ""
    lines: list[str] = []
    for block in value.get("blocks") or []:
        if not isinstance(block, dict):
            continue
        data = block.get("data") if isinstance(block.get("data"), dict) else {}
        btype = block.get("type")
        if btype == "header":
            text = clean_text(data.get("text") or "")
            if text:
                if lines:
                    lines.append("")
                lines.append(f"{text}:")
        elif btype == "paragraph":
            text = clean_text(data.get("text") or "")
            if text:
                lines.append(text)
        elif btype == "list":
            for raw_item in data.get("items") or []:
                text = clean_text(raw_item if isinstance(raw_item, str) else (raw_item or {}).get("content", ""))
                if text:
                    lines.append(f"— {text}")
    return "\n".join(lines).strip()


def parse_materials(detail_payload: dict) -> list[dict]:
    """Extract the real downloadable attachments (rules PDF, presentation
    deck, ...) — only present on the per-service detail page, not the list."""
    model = (detail_payload.get("props") or {}).get("model") or {}
    files = model.get("files")
    if not isinstance(files, list):
        return []
    materials = []
    for item in files:
        if not isinstance(item, dict) or not item.get("link"):
            continue
        materials.append(
            {
                "name": clean_text(item.get("name") or "Файл"),
                "url": item["link"],
                "mime": item.get("mime") or "",
                "size": item.get("prettySize") or "",
            }
        )
    return materials


def draft_payload(card: BgovCard) -> dict:
    conditions = [{"label": item["label"], "value": item["value"]} for item in card.conditions]
    documents = [
        {"name": item["value"], "auto": False}
        for item in card.evidence
        if item["kind"] == "document"
    ]
    return {
        "card": {
            "title": card.title,
            "summary": card.summary,
            "category": card.category,
            "conditions": conditions,
            "documents": documents,
            "description": card.description,
            "materials": card.materials,
        },
        "form": {
            "title": card.title,
            "pages": [
                {
                    "name": "company",
                    "title": "О компании",
                    "elements": [
                        {
                            "type": "text",
                            "name": "bin",
                            "title": "БИН / ИИН",
                            "isRequired": True,
                            "validators": [{"type": "regex", "regex": "^[0-9]{12}$", "text": "12 цифр"}],
                        }
                    ],
                },
                {
                    "name": "program",
                    "title": "Параметры программы",
                    "elements": [
                        {"type": "comment", "name": "project_description", "title": "Описание проекта"}
                    ],
                },
            ],
        },
        "extracted_rules": [
            {"rule": item["label"], "source_quote": item["sourceQuote"]} for item in card.evidence
        ],
        "source": {"url": card.url, "organization": card.org_name, "raw": card.raw},
    }


def clean_text(value) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def first_sentence(text: str) -> str:
    parts = re.split(r"(?<=[.!?])\s+", clean_text(text))
    return parts[0] if parts else ""


def normalize_category(value: str) -> str:
    raw = value.lower()
    mapping = {
        "credit": "credit",
        "кредит": "credit",
        "subsidy": "subsidy",
        "субсид": "subsidy",
        "guarantee": "guarantee",
        "гарант": "guarantee",
        "leasing": "leasing",
        "лизинг": "leasing",
        "insurance": "insurance",
        "страх": "insurance",
        "investment": "investment",
        "инвест": "investment",
    }
    for key, category in mapping.items():
        if key in raw:
            return category
    return "subsidy"
