"""Small, selector-configured adapters for server-rendered source pages.

The sources below publish their program data in HTML.  The parser deliberately
uses the standard library so the import worker has no browser dependency.
Each adapter returns compact, source-grounded candidates; the common pipeline
is responsible for robots checks, diffing, AI extraction and persistence.
"""

from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin


@dataclass
class HtmlServiceCandidate:
    title: str
    url: str
    text: str
    organization: str


class _BlockParser(HTMLParser):
    def __init__(self, block_class: str, title_tags: set[str]):
        super().__init__(convert_charrefs=True)
        self.block_class = block_class
        self.title_tags = title_tags
        self._blocks: list[dict] = []
        self.blocks: list[dict] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        classes = (dict(attrs).get("class") or "").split()
        for block in self._blocks:
            block["depth"] += 1
        if self.block_class in classes:
            self._blocks.append({"title": "", "href": "", "text": [], "tag": "", "depth": 1})
        for current in self._blocks:
            if tag in self.title_tags and not current["title"]:
                current["tag"] = tag
            if tag == "a" and not current["href"]:
                current["href"] = dict(attrs).get("href") or ""

    def handle_data(self, data: str):
        if not self._blocks:
            return
        value = " ".join(data.split())
        if not value:
            return
        for current in self._blocks:
            current["text"].append(value)
            if current["tag"] and not current["title"]:
                current["title"] = value

    def handle_endtag(self, tag: str):
        if not self._blocks:
            return
        completed: list[dict] = []
        for block in self._blocks:
            if block["tag"] == tag:
                block["tag"] = ""
            block["depth"] -= 1
            if block["depth"] == 0:
                completed.append(block)
        self._blocks = [block for block in self._blocks if block["depth"] > 0]
        self.blocks.extend(completed)


class HtmlScrapeAdapter:
    """Parse a known server-rendered listing without recursively crawling it."""

    def __init__(
        self,
        *,
        source_id: str,
        organization: str,
        listing_url: str,
        block_class: str,
        title_tags: set[str],
        max_candidates: int = 20,
    ):
        self.source_id = source_id
        self.organization = organization
        self.listing_url = listing_url
        self.block_class = block_class
        self.title_tags = title_tags
        self.max_candidates = max_candidates

    def extract(self, html: str) -> list[HtmlServiceCandidate]:
        parser = _BlockParser(self.block_class, self.title_tags)
        parser.feed(html)
        candidates: list[HtmlServiceCandidate] = []
        seen: set[str] = set()
        for index, block in enumerate(parser.blocks):
            title = block["title"].strip()
            text = " ".join(block["text"]).strip()
            if not title or len(text) < 20:
                continue
            url = urljoin(self.listing_url, block["href"] or f"#import-{index + 1}")
            if url in seen:
                continue
            seen.add(url)
            candidates.append(
                HtmlServiceCandidate(
                    title=title,
                    url=url,
                    text=text,
                    organization=self.organization,
                )
            )
            if len(candidates) >= self.max_candidates:
                break
        return candidates


class KafSubsidyAdapter(HtmlScrapeAdapter):
    """KAF has multiple subsidy blocks on one official page, not detail URLs."""

    def __init__(self):
        super().__init__(
            source_id="kaf",
            organization="КазАгроФинанс",
            listing_url="https://kaf.kz/products/subsidies/",
            block_class="subsidies",
            title_tags={"p"},
            max_candidates=20,
        )

    def extract(self, html: str) -> list[HtmlServiceCandidate]:
        # The KAF page omits closing tags between consecutive subsidy sections.
        # Split on the documented section marker before feeding each fragment to
        # the HTML parser, which keeps the extraction independent of layout CSS.
        candidates: list[HtmlServiceCandidate] = []
        for index, fragment in enumerate(html.split('<div class="subsidies">')[1:], start=1):
            parser = _KafFragmentParser()
            parser.feed(fragment)
            if not parser.title:
                continue
            candidates.append(
                HtmlServiceCandidate(
                    title=parser.title,
                    url=urljoin(self.listing_url, parser.href or f"#import-{index}"),
                    text=" ".join(parser.text),
                    organization=self.organization,
                )
            )
        return candidates[: self.max_candidates]


class _KafFragmentParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.href = ""
        self.text: list[str] = []
        self._title_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attributes = dict(attrs)
        if "subsidies-title" in (attributes.get("class") or "").split():
            self._title_depth = 1
        elif self._title_depth:
            self._title_depth += 1
        if tag == "a" and not self.href:
            self.href = attributes.get("href") or ""

    def handle_data(self, data: str):
        value = " ".join(data.split())
        if not value:
            return
        self.text.append(value)
        if self._title_depth and not self.title:
            self.title = value

    def handle_endtag(self, tag: str):
        if self._title_depth:
            self._title_depth -= 1
