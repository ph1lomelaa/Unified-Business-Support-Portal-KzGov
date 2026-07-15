"""Demo applications across the status spread (spec Часть 11) for cabinet,
admin queue and analytics. Direct inserts (applications are not part of the
constructor REQ-24). Idempotent by fixed application numbers. PDFs are
generated for every submitted+ application.

Run: `python -m app.seed_apps`  (after seed + seed_services).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from .calc import economy_simple
from .db import engine
from .models import (
    Application,
    ApplicationEvent,
    Company,
    Notification,
    Organization,
    Service,
)
from .pdf.generator import render_application_pdf
from .config import settings

# transition chains per final status (from, to, actor)
CHAINS: dict[str, list[tuple[str, str, str]]] = {
    "draft": [],
    "in_review": [("draft", "submitted", "client"), ("submitted", "in_review", "system")],
    "needs_changes": [
        ("draft", "submitted", "client"), ("submitted", "in_review", "system"),
        ("in_review", "needs_changes", "manager"),
    ],
    "approved": [
        ("draft", "submitted", "client"), ("submitted", "in_review", "system"),
        ("in_review", "approved", "manager"),
    ],
    "rejected": [
        ("draft", "submitted", "client"), ("submitted", "in_review", "system"),
        ("in_review", "rejected", "manager"),
    ],
    "active": [
        ("draft", "submitted", "client"), ("submitted", "in_review", "system"),
        ("in_review", "approved", "manager"), ("approved", "contract_signed", "client"),
        ("contract_signed", "active", "system"),
    ],
    "completed": [
        ("draft", "submitted", "client"), ("submitted", "in_review", "system"),
        ("in_review", "approved", "manager"), ("approved", "contract_signed", "client"),
        ("contract_signed", "active", "system"), ("active", "completed", "system"),
    ],
}

NEEDS_CHANGES_COMMENT = (
    "Приложите актуальную справку об отсутствии налоговой задолженности "
    "(не старше 30 дней). Текущая справка устарела."
)
REJECT_COMMENT = (
    "Проект не соответствует минимальной сумме программы. "
    "Рекомендуем рассмотреть субсидирование ставки."
)

# (number, bin, slug, status, days_ago, answers)
APPS: list[tuple] = [
    ("EPPB-2026-000101", "123456789012", "akk-animal", "in_review", 2,
     {"bin": "123456789012", "applicant_type": "direct",
      "target_use": ["Приобретение скота (КРС/МРС)", "Корма"],
      "loan_amount": 150000000, "loan_term": 24, "livestock_type": "cattle",
      "cattle_amount": 120000000, "cattle_head": 150,
      "program_rate": 5, "bank_rate": 18}),
    ("EPPB-2026-000102", "123456789012", "damu-subsidy", "needs_changes", 6,
     {"bin": "123456789012", "bank": "Halyk Bank", "loan_amount": 80000000,
      "bank_rate": 19, "loan_term": 36}),
    ("EPPB-2026-000103", "123456789012", "damu-guarantee", "approved", 9,
     {"bin": "123456789012", "loan_amount": 40000000, "guarantee_share": 60,
      "has_collateral": True}),
    ("EPPB-2026-000104", "987654321098", "kazakhexport-insurance", "completed", 40,
     {"bin": "987654321098", "buyer_country": "Узбекистан", "contract_amount": 25000000,
      "payment_term": "Отсрочка 60 дней"}),
    ("EPPB-2026-000105", "987654321098", "kzhk-mortgage-subsidy", "draft", 1,
     {"bin": "987654321098", "loan_amount": 30000000, "bank_rate": 20, "loan_term": 84}),
    ("EPPB-2026-000106", "555444333222", "brk-loan", "rejected", 12,
     {"bin": "555444333222", "project_name": "Модернизация цеха", "loan_amount": 3000000000,
      "loan_term": 8}),
    ("EPPB-2026-000107", "555444333222", "damu-subsidy", "active", 25,
     {"bin": "555444333222", "bank": "ForteBank", "loan_amount": 500000000,
      "bank_rate": 21, "loan_term": 48}),
]


def _calc_for(slug: str, a: dict) -> dict:
    if "loan_amount" in a and "bank_rate" in a and "loan_term" in a:
        prog = {"akk-animal": 5, "damu-subsidy": 7, "kzhk-mortgage-subsidy": 10}.get(slug, 7)
        return {"saving": round(economy_simple(a["loan_amount"], a["bank_rate"], prog, a["loan_term"]))}
    return {}


def seed_apps() -> None:
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        for number, bin_, slug, status, days_ago, answers in APPS:
            if db.exec(select(Application).where(Application.number == number)).first():
                print(f"  · {number} — уже есть, пропуск")
                continue
            service = db.exec(select(Service).where(Service.slug == slug)).first()
            if not service:
                print(f"  ! услуга {slug} не найдена — пропуск {number}")
                continue
            org = db.get(Organization, service.orgId)
            company = db.get(Company, bin_)
            calc = _calc_for(slug, answers)
            created = now - timedelta(days=days_ago)

            app = Application(
                number=number, serviceId=service.id, companyBin=bin_, status=status,
                answers=answers, calc=calc, createdAt=created, updatedAt=created,
                schemaSnapshot={},
            )
            db.add(app)
            db.flush()

            # events
            chain = CHAINS[status]
            for i, (frm, to, actor) in enumerate(chain):
                comment = None
                if to == "needs_changes":
                    comment = NEEDS_CHANGES_COMMENT
                elif to == "rejected":
                    comment = REJECT_COMMENT
                ts = created + timedelta(days=i)
                db.add(ApplicationEvent(
                    appId=app.id, fromStatus=frm, toStatus=to, actor=actor,
                    comment=comment, createdAt=ts,
                ))
                app.updatedAt = ts

            # PDF for submitted+
            if status != "draft" and company:
                pdf = render_application_pdf(
                    app_number=number, app_date=created.strftime("%d.%m.%Y"),
                    service_title=service.title, org_name=org.name if org else "",
                    company={"name": company.name, "bin": company.bin,
                             "director": company.director, "address": company.address,
                             "region": company.region},
                    answers=answers, calc=calc, doc_template=service.docTemplate,
                    signed_by=company.director,
                )
                (settings.upload_dir / f"{number}.pdf").write_bytes(pdf)
                app.pdfUrl = f"/storage/{number}.pdf"

            # notifications (a couple unread for the demo)
            if status != "draft":
                db.add(Notification(
                    userBin=bin_, title=f"Заявка {number} подана",
                    body=f"«{service.title}» принята на рассмотрение.",
                    appId=app.id, kind="status", read=True,
                    createdAt=created + timedelta(minutes=2),
                ))
            last = chain[-1] if chain else None
            if last and last[1] in ("needs_changes", "approved", "rejected"):
                unread = last[1] in ("needs_changes", "approved")
                labels = {"needs_changes": "требует доработки", "approved": "одобрена",
                          "rejected": "отклонена"}
                db.add(Notification(
                    userBin=bin_, title=f"Заявка {number} {labels[last[1]]}",
                    body=NEEDS_CHANGES_COMMENT if last[1] == "needs_changes"
                    else (REJECT_COMMENT if last[1] == "rejected"
                          else "Поздравляем! Заявка одобрена, ожидайте договор."),
                    appId=app.id, kind="status", read=not unread,
                    createdAt=app.updatedAt,
                ))
            db.add(app)
            print(f"  ✓ {number} — {slug} [{status}]")
        db.commit()
    print("Демо-заявки готовы.")


if __name__ == "__main__":
    seed_apps()
