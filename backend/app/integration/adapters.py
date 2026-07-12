"""Pluggable integration adapters, registered by `IntegrationSystem.adapterType`.

Each adapter turns a (system, operation, payload) into a response dict, or
raises AdapterError. The bus owns retries, timing and outbox logging — adapters
stay thin. Adding a new *type* of integration = one class + one registry entry;
adding a new integration of an existing type is pure admin config (no code).
"""

from __future__ import annotations

import time
from typing import Callable

from sqlmodel import Session

from ..models import IntegrationOperation, IntegrationSystem, gen_id


class AdapterError(Exception):
    """Recoverable failure — the bus may retry, then logs it to the outbox."""


# --- named mock resolvers -----------------------------------------------------
# An operation can set mockDataset = {"resolver": "<name>"} to delegate to a
# Python callable instead of returning a static blob. Lets a "mock" system
# return live-looking data (e.g. company lookup from the seeded registry).
_RESOLVERS: dict[str, Callable[[dict, Session], dict]] = {}


def resolver(name: str):
    def deco(fn: Callable[[dict, Session], dict]):
        _RESOLVERS[name] = fn
        return fn

    return deco


@resolver("gbd.company")
def _resolve_company(payload: dict, db: Session) -> dict:
    """ГБД ЮЛ: company profile by BIN, read from the seeded Company table."""
    from ..map_data import REGIONS
    from ..models import Company

    bin_ = str(payload.get("bin", "")).strip()
    company = db.get(Company, bin_)
    if not company:
        raise AdapterError("Компания не найдена. Демо-БИН: 123456789012")

    def industry_hint(oked: str) -> str:
        try:
            code = int(oked.split(".")[0])
        except (ValueError, AttributeError):
            return "services"
        if 1 <= code <= 3:
            return "agro"
        if 5 <= code <= 33:
            return "manufacturing"
        if 45 <= code <= 47:
            return "trade"
        return "services"

    region_hint = next((r["id"] for r in REGIONS if r["name"] == company.region), None)
    return {
        "bin": company.bin,
        "name": company.name,
        "form": company.form,
        "oked": company.oked,
        "okedName": company.okedName,
        "address": company.address,
        "region": company.region,
        "director": company.director,
        "category": company.category,
        "industryHint": industry_hint(company.oked),
        "regionHint": region_hint,
        "source": "ГБД ЮЛ (имитация)",
    }


# НСИ (нормативно-справочная информация) — a mock external registry that serves
# reference-dictionary items. `Dictionary(source="external")` syncs from here via
# bus.call("nsi-registry", "dictionary.fetch", {"code": ...}). Returns {"items":
# [{value,label,parentValue?}]} so the admin sync endpoint can upsert them.
_NSI_CATALOG: dict[str, list[dict]] = {
    "oked": [
        {"value": "01.11", "label": "Выращивание зерновых культур"},
        {"value": "01.13", "label": "Выращивание овощей, бахчевых, корнеплодов"},
        {"value": "01.41", "label": "Разведение молочного крупного рогатого скота"},
        {"value": "01.42", "label": "Разведение прочего крупного рогатого скота и буйволов"},
        {"value": "01.47", "label": "Разведение сельскохозяйственной птицы"},
        {"value": "10.11", "label": "Переработка и консервирование мяса"},
        {"value": "10.51", "label": "Производство молочной продукции"},
        {"value": "10.71", "label": "Производство хлеба и мучных кондитерских изделий"},
        {"value": "25.11", "label": "Производство строительных металлоконструкций"},
        {"value": "41.20", "label": "Строительство жилых и нежилых зданий"},
        {"value": "46.90", "label": "Неспециализированная оптовая торговля"},
        {"value": "47.11", "label": "Розничная торговля в неспециализированных магазинах"},
        {"value": "49.41", "label": "Грузовые перевозки автомобильным транспортом"},
        {"value": "62.01", "label": "Разработка программного обеспечения"},
        {"value": "62.02", "label": "Консультирование в области ИТ"},
        {"value": "72.19", "label": "Научные исследования и разработки"},
    ],
}


@resolver("nsi.dictionary")
def _resolve_nsi_dictionary(payload: dict, db: Session) -> dict:
    code = str(payload.get("code", "")).strip()
    items = _NSI_CATALOG.get(code)
    if items is None:
        raise AdapterError(f"НСИ: справочник '{code}' не найден в реестре")
    return {"code": code, "items": items, "source": "НСИ / внешний реестр (имитация)"}


# --- adapters -----------------------------------------------------------------
class Adapter:
    def execute(
        self,
        system: IntegrationSystem,
        op: IntegrationOperation | None,
        payload: dict,
        db: Session,
    ) -> dict:
        raise NotImplementedError


class MockAdapter(Adapter):
    """Returns the operation's admin-editable mockDataset, or delegates to a
    named resolver when mockDataset = {"resolver": "<name>"}."""

    def execute(self, system, op, payload, db) -> dict:
        data = dict(op.mockDataset) if (op and op.mockDataset) else {}
        name = data.get("resolver")
        if name:
            fn = _RESOLVERS.get(name)
            if not fn:
                raise AdapterError(f"Неизвестный resolver: {name}")
            return fn(payload, db)
        return data or {"ok": True, "echo": payload}


class RestAdapter(Adapter):
    """Real HTTP call to baseUrl + operation.path — proves готовность к
    интеграциям. {tokens} in the path are filled from the payload."""

    def execute(self, system, op, payload, db) -> dict:
        import httpx

        if not system.baseUrl or not op:
            raise AdapterError("REST adapter требует baseUrl и operation")
        path = op.path or ""
        for key, value in (payload or {}).items():
            path = path.replace("{" + key + "}", str(value))
        url = system.baseUrl.rstrip("/") + "/" + path.lstrip("/")
        headers: dict[str, str] = {}
        if system.authType == "apikey" and system.authSecret:
            headers["Authorization"] = f"Bearer {system.authSecret}"
        timeout = (system.timeoutMs or 6000) / 1000
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.request(op.method or "POST", url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001 — normalise transport errors
            raise AdapterError(str(exc)) from exc


class EsbAdapter(Adapter):
    """Единая интеграционная шина: routes the application to a dochka BPM.
    The bus already persists the outbox row + idempotency-key; here we mint the
    external BPM id and echo the routing target."""

    def execute(self, system, op, payload, db) -> dict:
        route = (op.mockDataset or {}).get("route") if op else None
        return {
            "accepted": True,
            "externalId": gen_id("bpm_"),
            "route": route,
            "acceptedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "note": "Заявка поставлена в очередь ЕИШ и маршрутизирована в BPM дочерней организации.",
        }


class OidcAdapter(Adapter):
    """eGov IDP — simulated OIDC login / callback."""

    def execute(self, system, op, payload, db) -> dict:
        return {
            "authenticated": True,
            "subject": payload.get("iin") or payload.get("bin") or "demo",
            "idp": system.name,
            "acr": "urn:egov:loa:substantial",
            "sessionId": gen_id("sess_"),
        }


class EdsAdapter(Adapter):
    """НУЦ / ЭЦП — simulated CMS-detached signature."""

    def execute(self, system, op, payload, db) -> dict:
        return {
            "signed": True,
            "signature": "cms-detached-" + gen_id(),
            "signedBy": payload.get("signedBy") or payload.get("director"),
            "algorithm": "ГОСТ 34.310 / RSA-PSS (demo)",
            "signedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }


_ADAPTERS: dict[str, Adapter] = {
    "mock": MockAdapter(),
    "rest": RestAdapter(),
    "esb": EsbAdapter(),
    "oidc": OidcAdapter(),
    "eds": EdsAdapter(),
}


def get_adapter(adapter_type: str) -> Adapter:
    return _ADAPTERS.get(adapter_type or "mock", _ADAPTERS["mock"])


def adapter_types() -> list[str]:
    return list(_ADAPTERS.keys())
