from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from time import sleep
from urllib.parse import urljoin

import httpx
from sqlmodel import Session, select

from ..models import NewsItem, Organization
from .pipeline import fetch_allowed
from .robots import RobotsGate


CONFIG_PATH = Path(__file__).with_name("news_sources.json")


@dataclass
class NewsCandidate:
    source_org_id: str
    title: str
    summary: str
    published_at: datetime
    source_url: str
    image_url: str | None = None


def load_news_sources() -> list[dict]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def import_news(db: Session) -> dict:
    stats: dict[str, dict] = {}
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        gate = RobotsGate(client)
        for source in load_news_sources():
            source_id = source["id"]
            found = changed = skipped = 0
            errors: list[str] = []
            try:
                candidates = fetch_source_news(client, gate, source)
                found = len(candidates)
                changed = persist_news(db, candidates)
            except PermissionError as exc:
                skipped = 1
                errors.append(str(exc))
            except Exception as exc:  # keep one bad site from blocking others
                errors.append(str(exc))
            stats[source_id] = {
                "name": source.get("name") or source_id,
                "found": found,
                "changed": changed,
                "skippedRobots": skipped,
                "errors": errors,
            }
    return stats


def fetch_source_news(
    client: httpx.Client,
    gate: RobotsGate,
    source: dict,
) -> list[NewsCandidate]:
    listing_html, _, robots = fetch_allowed(
        client,
        gate,
        source["baseUrl"],
        source["listingUrl"],
    )
    parser = _ListingParser(source)
    parser.feed(listing_html)
    candidates: list[NewsCandidate] = []
    seen: set[str] = set()
    for row in parser.items:
        if row["url"] in seen:
            continue
        seen.add(row["url"])
        summary, detail_image = fetch_detail_summary(client, gate, source, row["url"])
        candidates.append(
            NewsCandidate(
                source_org_id=source["sourceOrgId"],
                title=row["title"],
                summary=summary or row["summary"] or row["title"],
                published_at=parse_ru_date(row["date"]),
                source_url=row["url"],
                image_url=detail_image or row["imageUrl"],
            )
        )
        if len(candidates) >= int(source.get("maxItems") or 12):
            break
        sleep(robots.crawl_delay)
    return candidates


def fetch_detail_summary(
    client: httpx.Client,
    gate: RobotsGate,
    source: dict,
    url: str,
) -> tuple[str, str | None]:
    detail_html, _, _ = fetch_allowed(client, gate, source["baseUrl"], url)
    parser = _DetailParser(source)
    parser.feed(detail_html)
    return parser.summary(), parser.image_url


def persist_news(db: Session, candidates: list[NewsCandidate]) -> int:
    changed = 0
    imported_at = datetime.now(timezone.utc)
    for item in candidates:
        ensure_news_org(db, item.source_org_id)
        existing = db.exec(
            select(NewsItem).where(NewsItem.sourceUrl == item.source_url)
        ).first()
        if existing:
            dirty = False
            for key, value in {
                "sourceOrgId": item.source_org_id,
                "title": item.title,
                "summary": item.summary,
                "publishedAt": item.published_at,
                "imageUrl": item.image_url,
            }.items():
                if not same_value(getattr(existing, key), value):
                    setattr(existing, key, value)
                    dirty = True
            existing.importedAt = imported_at
            db.add(existing)
            changed += 1 if dirty else 0
            continue
        db.add(
            NewsItem(
                sourceOrgId=item.source_org_id,
                title=item.title,
                summary=item.summary,
                publishedAt=item.published_at,
                sourceUrl=item.source_url,
                imageUrl=item.image_url,
                importedAt=imported_at,
                status="draft",
            )
        )
        changed += 1
    db.commit()
    return changed


def ensure_news_org(db: Session, org_id: str) -> None:
    if db.get(Organization, org_id):
        return
    if org_id == "baiterek":
        db.add(
            Organization(
                id="baiterek",
                name="АО «Национальный управляющий холдинг „Байтерек“»",
                shortName="Байтерек",
                logo="",
                color="#0b7a3e",
            )
        )
        db.flush()


class _ListingParser(HTMLParser):
    def __init__(self, source: dict):
        super().__init__(convert_charrefs=True)
        selectors = source["selectors"]
        self.source = source
        self.item_tag = selectors["itemTag"]
        self.item_class = selectors["itemClass"]
        self.date_class = selectors["dateClass"]
        self.image_class = selectors["imageClass"]
        self.items: list[dict] = []
        self._stack: list[dict] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        for item in self._stack:
            item["depth"] += 1
        if tag == self.item_tag and self.item_class in classes:
            self._stack.append(
                {
                    "depth": 1,
                    "url": urljoin(self.source["baseUrl"], attributes.get("href") or ""),
                    "title": attributes.get("title") or "",
                    "date": "",
                    "summaryParts": [],
                    "capture": "",
                    "imageUrl": None,
                }
            )
            return
        for item in self._stack:
            if tag in {"h1", "h2", "h3", "h4", "h5", "h6"} and not item["title"]:
                item["capture"] = "title"
            elif self.date_class in classes:
                item["capture"] = "date"
            elif tag == "p":
                item["capture"] = "summary"
            if self.image_class in classes:
                image = image_from_style(attributes.get("style") or "")
                if image and not item["imageUrl"]:
                    item["imageUrl"] = urljoin(self.source["baseUrl"], image)

    def handle_data(self, data: str):
        value = compact(data)
        if not value:
            return
        for item in self._stack:
            if item["capture"] == "title" and not item["title"]:
                item["title"] = value
            elif item["capture"] == "date" and not item["date"]:
                item["date"] = value
            elif item["capture"] == "summary":
                item["summaryParts"].append(value)

    def handle_endtag(self, tag: str):
        completed: list[dict] = []
        for item in self._stack:
            if tag in {"h1", "h2", "h3", "h4", "h5", "h6", "p", "span"}:
                item["capture"] = ""
            item["depth"] -= 1
            if item["depth"] == 0:
                completed.append(item)
        self._stack = [item for item in self._stack if item["depth"] > 0]
        for item in completed:
            if item["url"] and item["title"] and item["date"]:
                item["summary"] = compact(" ".join(item["summaryParts"]))
                self.items.append(item)


class _DetailParser(HTMLParser):
    def __init__(self, source: dict):
        super().__init__(convert_charrefs=True)
        selectors = source["selectors"]
        self.base_url = source["baseUrl"]
        self.detail_container_class = selectors["detailContainerClass"]
        self.detail_text_class = selectors["detailTextClass"]
        self.detail_image_class = selectors["detailImageClass"]
        self.image_url: str | None = None
        self._in_detail = 0
        self._in_text = 0
        self._in_p = 0
        self._paragraphs: list[str] = []
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        if self._in_detail:
            self._in_detail += 1
        if self.detail_container_class in classes:
            self._in_detail = 1
        if self._in_detail and self.detail_text_class in classes:
            self._in_text = 1
        elif self._in_text:
            self._in_text += 1
        if self._in_text and tag == "p":
            self._in_p = 1
            self._buffer = []
        if self._in_detail and tag == "img" and not self.image_url:
            if self.detail_image_class in classes or attributes.get("src"):
                self.image_url = urljoin(self.base_url, attributes.get("src") or "")

    def handle_data(self, data: str):
        if self._in_p:
            value = compact(data)
            if value:
                self._buffer.append(value)

    def handle_endtag(self, tag: str):
        if self._in_p and tag == "p":
            text = compact(" ".join(self._buffer))
            if len(text) > 40:
                self._paragraphs.append(text)
            self._in_p = 0
        if self._in_text:
            self._in_text -= 1
        if self._in_detail:
            self._in_detail -= 1

    def summary(self) -> str:
        text = next((p for p in self._paragraphs if "Справочная информация" not in p), "")
        return text[:420]


def parse_ru_date(value: str) -> datetime:
    parsed = datetime.strptime(value.strip(), "%d.%m.%Y")
    return parsed.replace(tzinfo=timezone.utc)


def image_from_style(style: str) -> str | None:
    match = re.search(r"url\\(['\\\"]?([^)'\\\"]+)['\\\"]?\\)", style)
    return unescape(match.group(1)) if match else None


def compact(value: str) -> str:
    return " ".join(unescape(value).split())


def same_value(left, right) -> bool:
    if isinstance(left, datetime) and isinstance(right, datetime):
        return left.date() == right.date()
    return left == right
