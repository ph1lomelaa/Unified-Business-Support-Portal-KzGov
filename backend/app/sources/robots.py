from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import httpx

USER_AGENT = "EPPB-ImportBot/1.0 (+contact: integrations@eppb.kz)"


@dataclass
class RobotsResult:
    allowed: bool
    robots_url: str
    raw: str
    crawl_delay: float


class RobotsGate:
    def __init__(self, client: httpx.Client):
        self.client = client
        self._cache: dict[str, tuple[RobotFileParser, str, str]] = {}

    def check(self, base_url: str, url: str) -> RobotsResult:
        robots_url = urljoin(base_url.rstrip("/") + "/", "robots.txt")
        parser, raw, robots_url = self._cache.get(base_url) or self._load(base_url, robots_url)
        delay = parser.crawl_delay(USER_AGENT) or parser.crawl_delay("*") or 1
        return RobotsResult(
            allowed=parser.can_fetch(USER_AGENT, url),
            robots_url=robots_url,
            raw=raw,
            crawl_delay=max(float(delay), 1.0),
        )

    def _load(self, base_url: str, robots_url: str) -> tuple[RobotFileParser, str, str]:
        parser = RobotFileParser()
        raw = ""
        try:
            response = self.client.get(robots_url, headers={"User-Agent": USER_AGENT})
            if response.status_code == 200:
                raw = response.text
                parser.parse(raw.splitlines())
            else:
                parser.parse(["User-agent: *", "Allow: /"])
        except httpx.HTTPError:
            parser.parse(["User-agent: *", "Disallow: /"])
        result = (parser, raw, robots_url)
        self._cache[base_url] = result
        return result
