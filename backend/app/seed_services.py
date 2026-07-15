"""Seed the 7 demo services THROUGH the constructor API (REQ-24).

Uses FastAPI TestClient in-process — the exact same endpoints the admin UI
calls (create -> PATCH card -> PUT form -> publish). Nothing is inserted
directly, proving services are authored via the public constructor, not
hardcoded. Idempotent: skips services whose slug already exists.

Run: `python -m app.seed_services`  (after `python -m app.seed`).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from .config import settings
from .main import app
from .seed import seed_reference_data
from .session import SessionUser, encode_session


# --------- reusable schema fragments ---------
def company_page() -> dict:
    return {
        "name": "company",
        "title": "О компании",
        "elements": [
            {
                "type": "text",
                "name": "bin",
                "title": "БИН / ИИН",
                "isRequired": True,
                "validators": [
                    {"type": "regex", "regex": "^[0-9]{12}$", "text": "12 цифр"}
                ],
            },
            {"type": "text", "name": "company_name", "title": "Наименование", "readOnly": True},
            {"type": "text", "name": "director", "title": "Первый руководитель", "readOnly": True},
            {"type": "text", "name": "region", "title": "Регион", "readOnly": True},
        ],
    }


# --------- 7 services (card + form) ---------
SERVICES: list[dict] = [
    # 1. АКК — животноводство (flagship: реальные цифры с bgov.kz/agroanimal2 +
    #    agrocredit.kz — ставка 5%/1,5%, до 1,5 млрд, срок 36 мес, правило 70%,
    #    ветвление по типу заёмщика, формула экономии)
    {
        "create": {"title": "Агробизнес: льготное кредитование животноводства", "orgId": "akk", "category": "credit", "slug": "akk-animal"},
        "card": {
            "summary": "Льготный кредит АО «Аграрная кредитная корпорация» на пополнение оборотных средств откормочных площадок: ставка 5% прямым заёмщикам, до 1,5 млрд ₸, срок до 36 месяцев. Не менее 70% суммы — на приобретение скота.",
            "description": (
                "Программа АО «Аграрная кредитная корпорация» (группа «Байтерек») для "
                "сельхозтоваропроизводителей и финансовых институтов — на пополнение "
                "оборотных средств откормочных площадок: приобретение откормочного "
                "поголовья (КРС/МРС), кормов, ГСМ и запчастей для кормоприготовительной "
                "и кормораздаточной техники, чипов и бирок.\n"
                "Ставка вознаграждения: 5% годовых прямым заёмщикам (ГЭСВ от 5%); 1,5% "
                "финансовым институтам — КТ/БВУ, МФО, РИЦ (маржа конечным заёмщикам не "
                "более 3,5%). Сумма до 1,5 млрд ₸ на заёмщика, срок до 36 месяцев. Не "
                "менее 70% суммы займа направляется на приобретение скота. Обеспечение — "
                "согласно Залоговой политике Общества."
            ),
            "category": "credit",
            "reviewDays": 5,
            "conditions": [
                {"label": "Ставка", "value": "5% / 1,5%"},
                {"label": "Сумма", "value": "до 1,5 млрд ₸"},
                {"label": "Срок", "value": "до 36 мес"},
                {"label": "На скот", "value": "не менее 70%"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "Справка об отсутствии налоговой задолженности", "auto": True},
                {"name": "Заявление, анкета, согласия (шаблон АКК)", "auto": False},
                {"name": "Перечень документов для получения займа", "auto": False},
                {"name": "Перечень документов залогодателя, гаранта", "auto": False},
            ],
            "eligibility": {
                "questions": [
                    {"id": "size", "q": "Размер вашего бизнеса", "opts": ["micro", "small", "medium", "large"]},
                    {"id": "industry", "q": "Отрасль проекта", "opts": ["agro", "manufacturing", "trade", "services"]},
                ],
                "rules": [
                    {"if": {"industry": ["manufacturing", "trade", "services"]}, "verdict": "no",
                     "why": "Программа предназначена для агросектора (животноводство).", "alt": "damu-subsidy"},
                    {"if": {"size": ["large"]}, "verdict": "no",
                     "why": "Программа для МСБ. Крупному бизнесу — займы БРК.", "alt": "brk-loan"},
                ],
                "default": "yes",
            },
            "faq": [
                {"q": "На что можно направить кредит?", "a": "На пополнение оборотных средств откормочной площадки: приобретение скота (КРС/МРС), кормов, ГСМ, запчастей для техники, чипов и бирок. Не менее 70% суммы — на приобретение скота."},
                {"q": "Какая ставка вознаграждения?", "a": "5% годовых прямым заёмщикам (сельхозтоваропроизводителям). Финансовым институтам (КТ/БВУ, МФО, РИЦ) — 1,5%, при этом маржа конечным заёмщикам не более 3,5%."},
                {"q": "Максимальная сумма и срок?", "a": "До 1,5 млрд ₸ на заёмщика, срок до 36 месяцев."},
                {"q": "Какое нужно обеспечение?", "a": "Согласно Залоговой политике Общества: недвижимость, техника и оборудование, приобретаемый скот либо гарантия."},
            ],
            "tags": {"bizSize": ["micro", "small", "medium"], "industries": ["agro"], "regions": []},
            "docTemplate": (
                "ЗАЯВЛЕНИЕ №{{app.number}} от {{app.date}}\n\n"
                "Заявитель: {{company.name}} (БИН {{company.bin}}),\n"
                "в лице первого руководителя {{company.director}},\n"
                "просит предоставить льготный кредит на пополнение оборотных средств\n"
                "откормочной площадки в сумме {{answers.loan_amount}} ₸ сроком на {{answers.loan_term}} мес.\n\n"
                "На приобретение скота направляется {{answers.cattle_amount}} ₸.\n"
                "Ожидаемая экономия относительно рыночной ставки: {{calc.saving}} ₸."
            ),
        },
        "schema": {
            "title": "Заявка: льготное кредитование животноводства",
            "showProgressBar": "top",
            "pages": [
                company_page(),
                {
                    "name": "borrower",
                    "title": "Заёмщик и цель",
                    "elements": [
                        {"type": "radiogroup", "name": "applicant_type", "title": "Кто подаёт заявку", "isRequired": True,
                         "defaultValue": "direct",
                         "choices": [
                             {"value": "direct", "text": "Прямой заёмщик — сельхозтоваропроизводитель (ставка 5%)"},
                             {"value": "intermediary", "text": "Финансовый институт: КТ/БВУ, МФО, РИЦ (ставка 1,5%)"},
                         ]},
                        {"type": "html", "name": "rate_hint",
                         "html": "<div style='padding:8px 12px;background:#e3f1ec;border-radius:8px;color:#0f6e56;font-size:13px'>Ставка зависит от типа заёмщика: 5% — прямым заёмщикам, 1,5% — финансовым институтам (маржа конечным заёмщикам не более 3,5%).</div>"},
                        {"type": "text", "inputType": "number", "name": "final_borrowers", "title": "Число конечных заёмщиков для финансирования",
                         "visibleIf": "{applicant_type} = 'intermediary'", "min": 1,
                         "description": "Сколько сельхозтоваропроизводителей вы прокредитуете за счёт займа"},
                        {"type": "checkbox", "name": "target_use", "title": "Целевое использование (пополнение оборотных средств)",
                         "isRequired": True,
                         "choices": [
                             "Приобретение скота (КРС/МРС)",
                             "Корма",
                             "ГСМ и запчасти для кормовой техники",
                             "Чипы и бирки",
                         ]},
                    ],
                },
                {
                    "name": "loan",
                    "title": "Параметры займа",
                    "elements": [
                        {"type": "text", "inputType": "number", "name": "loan_amount", "title": "Сумма займа, ₸", "isRequired": True, "min": 3000000, "max": 1500000000,
                         "description": "До 1,5 млрд ₸ на заёмщика"},
                        {"type": "text", "inputType": "number", "name": "loan_term", "title": "Срок займа, мес", "isRequired": True, "min": 6, "max": 36, "defaultValue": 24,
                         "description": "Не более 36 месяцев"},
                    ],
                },
                {
                    "name": "cattle",
                    "title": "Приобретение скота",
                    "elements": [
                        {"type": "dropdown", "name": "livestock_type", "title": "Вид скота", "isRequired": True,
                         "choices": [
                             {"value": "cattle", "text": "КРС — крупный рогатый скот"},
                             {"value": "small", "text": "МРС — мелкий рогатый скот"},
                         ]},
                        {"type": "text", "inputType": "number", "name": "cattle_amount", "title": "Сумма на приобретение скота, ₸", "isRequired": True,
                         "validators": [{"type": "expression", "expression": "{cattle_amount} >= {loan_amount} * 0.7",
                                          "text": "Не менее 70% суммы займа должно идти на приобретение скота"}]},
                        {"type": "text", "inputType": "number", "name": "cattle_head", "title": "Поголовье, голов", "min": 1},
                        {"type": "html", "name": "rule70", "html": "<div style='padding:8px 12px;background:#e3f1ec;border-radius:8px;color:#0f6e56;font-size:13px'>Правило программы: не менее 70% суммы займа направляется на приобретение скота.</div>"},
                    ],
                },
                {
                    "name": "calc",
                    "title": "Расчёт",
                    "elements": [
                        {"type": "text", "inputType": "number", "name": "bank_rate", "title": "Рыночная ставка банка, %", "defaultValue": 18, "min": 8, "max": 30,
                         "description": "Для сравнения экономии с рыночным кредитом"},
                        # Экономия относительно рыночного кредита. Ставка по программе —
                        # 5% (прямой заёмщик, основной сценарий). Формула — чистая
                        # арифметика (проверенный паттерн, как в остальных услугах):
                        # никаких iif/вычисляемых полей, поэтому и расчёт, и серверный
                        # пересчёт при подаче работают стабильно.
                        {"type": "expression", "name": "saving", "title": "Ваша экономия относительно рыночного кредита за срок займа",
                         "expression": "{loan_amount} * ({bank_rate} - 5) / 100 * {loan_term} / 12",
                         "displayStyle": "currency", "currency": "KZT"},
                        {"type": "html", "name": "rate_note",
                         "html": "<div style='padding:8px 12px;background:#e3f1ec;border-radius:8px;color:#0f6e56;font-size:13px'>Ставка по программе: 5% годовых прямым заёмщикам, 1,5% — финансовым институтам. Расчёт экономии показан для прямого заёмщика (5%).</div>"},
                    ],
                },
                # --- II этап: расширенные данные и документы (stage=2) ---
                # Собирается ПОСЛЕ первичной подачи, из личного кабинета.
                # Пометка `stage: 2` делает услугу многоэтапной без изменений кода.
                {
                    "name": "extended",
                    "title": "Дополнительные сведения и документы",
                    "stage": 2,
                    "description": "Заполняется после принятия первичной заявки для передачи в BPM-систему АКК.",
                    "elements": [
                        {"type": "html", "name": "stage2_intro", "html": "<div style='padding:8px 12px;background:#fff5e6;border-radius:8px;color:#8a5a10;font-size:13px'>Первичная заявка принята. Для передачи в работу предоставьте залоговое обеспечение, финансовые показатели и данные по договору на скот.</div>"},
                        {"type": "dropdown", "name": "collateral_type", "title": "Тип залогового обеспечения", "isRequired": True,
                         "choices": [{"value": "realestate", "text": "Недвижимость"}, {"value": "equipment", "text": "Техника и оборудование"}, {"value": "cattle", "text": "Приобретаемый скот"}, {"value": "guarantee", "text": "Гарантия Даму"}]},
                        {"type": "text", "inputType": "number", "name": "collateral_value", "title": "Оценочная стоимость залога, ₸", "isRequired": True, "min": 1000000},
                        {"type": "text", "inputType": "number", "name": "annual_revenue", "title": "Выручка за последний год, ₸", "isRequired": True, "min": 0},
                        {"type": "text", "inputType": "number", "name": "employees", "title": "Среднесписочная численность, чел.", "min": 1, "defaultValue": 5},
                        {"type": "text", "name": "cattle_supplier", "title": "Поставщик скота", "isRequired": True},
                        {"type": "text", "name": "cattle_contract_no", "title": "№ договора на приобретение скота"},
                        {"type": "boolean", "name": "has_vet_passport", "title": "Есть ветеринарные паспорта на поголовье?", "defaultValue": True},
                        {"type": "comment", "name": "stage2_note", "title": "Дополнительная информация для эксперта"},
                    ],
                },
            ],
        },
    },
    # 2. Даму — субсидирование ставки (7%, до 7 млрд, 45->12 полей)
    {
        "create": {"title": "Субсидирование ставки вознаграждения", "orgId": "damu", "category": "subsidy", "slug": "damu-subsidy"},
        "card": {
            "summary": "Государство компенсирует часть ставки по кредиту — вы платите 7%. Заявка сокращена с 45 до 12 полей.",
            "description": "Субсидирование ставки вознаграждения по кредитам МСБ. Итоговая ставка для предпринимателя — 7%. Сумма до 7 млрд ₸.",
            "category": "subsidy",
            "reviewDays": 5,
            "conditions": [
                {"label": "Ставка для вас", "value": "7%"},
                {"label": "Сумма", "value": "до 7 млрд ₸"},
                {"label": "Полей в заявке", "value": "12 вместо 45"},
                {"label": "Срок", "value": "до 60 мес"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "Справка об отсутствии налоговой задолженности", "auto": True},
                {"name": "Кредитный договор с банком", "auto": False},
            ],
            "eligibility": {
                "questions": [
                    {"id": "size", "q": "Размер вашего бизнеса", "opts": ["micro", "small", "medium", "large"]},
                ],
                "rules": [{"if": {"size": ["large"]}, "verdict": "no", "why": "Программа для МСБ.", "alt": "brk-loan"}],
                "default": "yes",
            },
            "faq": [{"q": "Кто выплачивает субсидию?", "a": "Государство перечисляет разницу в ставке напрямую банку."}],
            "tags": {"bizSize": ["micro", "small", "medium"], "industries": ["manufacturing", "trade", "services", "agro"], "regions": []},
            "docTemplate": (
                "ЗАЯВЛЕНИЕ №{{app.number}} от {{app.date}}\n\n"
                "{{company.name}} (БИН {{company.bin}}) просит субсидировать ставку\n"
                "по кредиту на сумму {{answers.loan_amount}} ₸.\n"
                "Экономия за срок: {{calc.saving}} ₸."
            ),
        },
        "schema": {
            "title": "Заявка: субсидирование ставки",
            "showProgressBar": "top",
            "pages": [
                company_page(),
                {
                    "name": "loan",
                    "title": "О кредите",
                    "elements": [
                        {"type": "dropdown", "name": "bank", "title": "Банк-кредитор", "isRequired": True,
                         "choices": ["Halyk Bank", "Kaspi Bank", "ForteBank", "Bank CenterCredit", "Jusan Bank"]},
                        {"type": "text", "inputType": "number", "name": "loan_amount", "title": "Сумма кредита, ₸", "isRequired": True, "min": 3000000, "max": 7000000000},
                        {"type": "text", "inputType": "number", "name": "bank_rate", "title": "Ставка банка, %", "isRequired": True, "min": 8, "max": 25, "defaultValue": 19},
                        {"type": "text", "inputType": "number", "name": "loan_term", "title": "Срок, мес", "isRequired": True, "min": 12, "max": 60, "defaultValue": 36},
                    ],
                },
                {
                    "name": "calc",
                    "title": "Расчёт экономии",
                    "elements": [
                        {"type": "expression", "name": "saving", "title": "Экономия за срок кредита",
                         "expression": "{loan_amount} * ({bank_rate} - 7) / 100 * {loan_term} / 12",
                         "displayStyle": "currency", "currency": "KZT"},
                    ],
                },
            ],
        },
    },
    # 3. Даму — гарантирование
    {
        "create": {"title": "Гарантирование по кредитам", "orgId": "damu", "category": "guarantee", "slug": "damu-guarantee"},
        "card": {
            "summary": "Фонд «Даму» выступает поручителем по вашему кредиту — до 85% суммы, если не хватает залога.",
            "description": "Гарантирование по кредитам МСБ до 85% суммы займа. Решает проблему недостатка залогового обеспечения.",
            "category": "guarantee",
            "reviewDays": 5,
            "conditions": [
                {"label": "Гарантия", "value": "до 85%"},
                {"label": "Сумма", "value": "до 1 млрд ₸"},
                {"label": "Срок", "value": "до 60 мес"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "Заявка на кредит в банке", "auto": False},
            ],
            "eligibility": {"questions": [{"id": "size", "q": "Размер бизнеса", "opts": ["micro", "small", "medium", "large"]}],
                             "rules": [{"if": {"size": ["large"]}, "verdict": "no", "why": "Программа для МСБ."}], "default": "yes"},
            "faq": [{"q": "Нужен ли залог?", "a": "Гарантия покрывает часть недостающего залога — до 85%."}],
            "tags": {"bizSize": ["micro", "small", "medium"], "industries": [], "regions": []},
            "docTemplate": "ЗАЯВЛЕНИЕ №{{app.number}}\n{{company.name}} просит гарантию на {{answers.guarantee_share}}% суммы {{answers.loan_amount}} ₸.",
        },
        "schema": {
            "title": "Заявка: гарантирование",
            "pages": [
                company_page(),
                {"name": "g", "title": "Параметры гарантии", "elements": [
                    {"type": "text", "inputType": "number", "name": "loan_amount", "title": "Сумма кредита, ₸", "isRequired": True, "min": 1000000, "max": 1000000000},
                    {"type": "text", "inputType": "number", "name": "guarantee_share", "title": "Требуемая гарантия, %", "min": 10, "max": 85, "defaultValue": 50},
                    {"type": "boolean", "name": "has_collateral", "title": "Есть ли частичный залог?"},
                ]},
            ],
        },
    },
    # 4. KazakhExport — страхование экспортного контракта
    {
        "create": {"title": "Страхование экспортного контракта", "orgId": "kazakhexport", "category": "insurance", "slug": "kazakhexport-insurance"},
        "card": {
            "summary": "Защита от неоплаты иностранным покупателем — покрытие до 90% суммы контракта.",
            "description": "Страхование экспортных контрактов от коммерческих и политических рисков. Покрытие до 90%.",
            "category": "insurance",
            "reviewDays": 7,
            "conditions": [
                {"label": "Покрытие", "value": "до 90%"},
                {"label": "Рынки", "value": "120+ стран"},
                {"label": "Срок", "value": "до 12 мес"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "Экспортный контракт", "auto": False},
            ],
            "eligibility": {"questions": [{"id": "industry", "q": "Отрасль", "opts": ["manufacturing", "agro", "services", "trade"]}],
                             "rules": [], "default": "yes"},
            "faq": [{"q": "Какие риски покрываются?", "a": "Неоплата покупателем, банкротство, политические риски страны-импортёра."}],
            "tags": {"bizSize": ["small", "medium", "large"], "industries": ["manufacturing", "agro"], "regions": []},
            "docTemplate": "ЗАЯВЛЕНИЕ №{{app.number}}\n{{company.name}} страхует контракт на {{answers.contract_amount}} ₸ ({{answers.buyer_country}}).",
        },
        "schema": {
            "title": "Заявка: страхование экспорта",
            "pages": [
                company_page(),
                {"name": "contract", "title": "Об экспортном контракте", "elements": [
                    {"type": "text", "name": "buyer_country", "title": "Страна покупателя", "isRequired": True},
                    {"type": "text", "inputType": "number", "name": "contract_amount", "title": "Сумма контракта, ₸", "isRequired": True, "min": 1000000},
                    {"type": "dropdown", "name": "payment_term", "title": "Условия оплаты",
                     "choices": ["Предоплата", "Отсрочка 30 дней", "Отсрочка 60 дней", "Отсрочка 90 дней"]},
                ]},
            ],
        },
    },
    # 5. БРК — крупные проекты
    {
        "create": {"title": "Кредитование крупных проектов", "orgId": "brk", "category": "credit", "slug": "brk-loan"},
        "card": {
            "summary": "Долгосрочное финансирование крупных инвестиционных проектов от 7 млрд ₸ на срок до 20 лет.",
            "description": "Банк развития Казахстана финансирует крупные проекты в промышленности и инфраструктуре.",
            "category": "credit",
            "reviewDays": 10,
            "conditions": [
                {"label": "Сумма", "value": "от 7 млрд ₸"},
                {"label": "Срок", "value": "до 20 лет"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "ТЭО проекта", "auto": False},
                {"name": "Финансовая модель", "auto": False},
            ],
            "eligibility": {"questions": [{"id": "size", "q": "Размер бизнеса", "opts": ["micro", "small", "medium", "large"]}],
                             "rules": [{"if": {"size": ["micro", "small"]}, "verdict": "no",
                                        "why": "БРК финансирует крупные проекты. Для МСБ — программы Даму.", "alt": "damu-subsidy"}],
                             "default": "yes"},
            "faq": [{"q": "Минимальная сумма?", "a": "От 7 млрд ₸ — программа для крупных инвестпроектов."}],
            "tags": {"bizSize": ["large"], "industries": ["manufacturing"], "regions": []},
            "docTemplate": "ЗАЯВЛЕНИЕ №{{app.number}}\nПроект «{{answers.project_name}}» на сумму {{answers.loan_amount}} ₸.",
        },
        "schema": {
            "title": "Заявка: финансирование крупного проекта",
            "pages": [
                company_page(),
                {"name": "project", "title": "О проекте", "elements": [
                    {"type": "text", "name": "project_name", "title": "Название проекта", "isRequired": True},
                    {"type": "text", "inputType": "number", "name": "loan_amount", "title": "Требуемая сумма, ₸", "isRequired": True, "min": 7000000000},
                    {"type": "text", "inputType": "number", "name": "loan_term", "title": "Срок, лет", "min": 3, "max": 20, "defaultValue": 10},
                    {"type": "comment", "name": "project_desc", "title": "Краткое описание проекта"},
                ]},
            ],
        },
    },
    # 6. КЖК — субсидирование ипотечной ставки (формула из приказа №34)
    {
        "create": {"title": "Субсидирование ставки по ипотеке для бизнеса", "orgId": "kzhk", "category": "subsidy", "slug": "kzhk-mortgage-subsidy"},
        "card": {
            "summary": "Субсидирование ставки по ипотечным займам на коммерческую недвижимость. Итоговая ставка для бизнеса — не выше 10%.",
            "description": "Казахстанская жилищная компания субсидирует ставку по ипотеке на коммерческие объекты.",
            "category": "subsidy",
            "reviewDays": 5,
            "conditions": [
                {"label": "Ставка", "value": "до 6%"},
                {"label": "Итог", "value": "≤10%"},
                {"label": "Сумма", "value": "до 500 млн ₸"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "Договор ипотечного займа", "auto": False},
            ],
            "eligibility": {"questions": [{"id": "size", "q": "Размер бизнеса", "opts": ["micro", "small", "medium", "large"]}],
                             "rules": [], "default": "yes"},
            "faq": [{"q": "Как считается субсидия?", "a": "Субсидия покрывает до 6 процентных пунктов ставки — итоговая ставка для бизнеса не превышает 10%."}],
            "tags": {"bizSize": ["micro", "small", "medium"], "industries": ["services", "trade"], "regions": []},
            "docTemplate": "ЗАЯВЛЕНИЕ №{{app.number}}\n{{company.name}} — ипотека {{answers.loan_amount}} ₸. Экономия: {{calc.saving}} ₸.",
        },
        "schema": {
            "title": "Заявка: субсидирование ипотечной ставки",
            "pages": [
                company_page(),
                {"name": "loan", "title": "Об ипотечном займе", "elements": [
                    {"type": "text", "inputType": "number", "name": "loan_amount", "title": "Сумма займа, ₸", "isRequired": True, "min": 5000000, "max": 500000000},
                    {"type": "text", "inputType": "number", "name": "bank_rate", "title": "Ставка банка, %", "min": 10, "max": 25, "defaultValue": 20},
                    {"type": "text", "inputType": "number", "name": "loan_term", "title": "Срок, мес", "min": 12, "max": 120, "defaultValue": 84},
                    {"type": "expression", "name": "saving", "title": "Экономия за срок",
                     "expression": "{loan_amount} * ({bank_rate} - 10) / 100 * {loan_term} / 12",
                     "displayStyle": "currency", "currency": "KZT"},
                ]},
            ],
        },
    },
    # 7. БРК-Лизинг — приобретение вагонов в лизинг (сложная многоэтапная услуга,
    #    I этап + II этап; контрольный кейс bgov.kz/services/wagons_ind).
    {
        "create": {"title": "Приобретение вагонов в лизинг", "orgId": "brk", "category": "leasing", "slug": "brk-wagons-leasing"},
        "card": {
            "summary": "Финансовый лизинг грузовых вагонов для транспортных и промышленных компаний. I этап — заявка, II этап — расширенные данные и документы.",
            "description": "Приобретение грузового подвижного состава (полувагоны, цистерны, платформы, хопперы) в финансовый лизинг. Аванс от 15%, срок до 120 месяцев. Услуга оформляется в два этапа: первичная заявка и последующее предоставление финансовых данных и документов по предмету лизинга.",
            "category": "leasing",
            "reviewDays": 10,
            "conditions": [
                {"label": "Аванс", "value": "от 15%"},
                {"label": "Срок", "value": "до 120 мес"},
                {"label": "Предмет", "value": "грузовые вагоны"},
                {"label": "Этапы", "value": "2 этапа"},
            ],
            "documents": [
                {"name": "Справка о государственной регистрации", "auto": True},
                {"name": "Справка об отсутствии налоговой задолженности", "auto": True},
                {"name": "Финансовая отчётность за 2 года", "auto": False},
                {"name": "Спецификация и договор с поставщиком вагонов", "auto": False},
                {"name": "Устав (для ТОО)", "auto": False, "condition": "TOO"},
            ],
            "eligibility": {
                "questions": [
                    {"id": "size", "q": "Размер вашего бизнеса", "opts": ["micro", "small", "medium", "large"]},
                    {"id": "industry", "q": "Отрасль проекта", "opts": ["manufacturing", "trade", "services", "agro"]},
                ],
                "rules": [
                    {"if": {"size": ["micro"]}, "verdict": "no",
                     "why": "Лизинг вагонов оформляют средние и крупные компании. Для микробизнеса — гарантирование Даму.", "alt": "damu-guarantee"},
                ],
                "default": "yes",
            },
            "faq": [
                {"q": "Какой минимальный аванс?", "a": "От 15% стоимости предмета лизинга."},
                {"q": "Что происходит после первичной заявки?", "a": "На II этапе вы предоставляете финансовую отчётность и документы по вагонам и поставщику."},
            ],
            "tags": {"bizSize": ["small", "medium", "large"], "industries": ["manufacturing", "trade", "services"], "regions": []},
            "docTemplate": (
                "ЗАЯВЛЕНИЕ №{{app.number}} от {{app.date}}\n\n"
                "Заявитель: {{company.name}} (БИН {{company.bin}}),\n"
                "в лице {{company.director}}, просит предоставить в финансовый лизинг\n"
                "грузовые вагоны в количестве {{answers.wagon_count}} ед.\n"
                "Ориентировочная стоимость предмета лизинга: {{calc.total_cost}} ₸,\n"
                "авансовый платёж ({{answers.advance_share}}%): {{calc.advance_amount}} ₸,\n"
                "сумма финансирования: {{calc.financed}} ₸ на срок {{answers.lease_term}} мес."
            ),
        },
        "schema": {
            "title": "Заявка: приобретение вагонов в лизинг",
            "showProgressBar": "top",
            "pages": [
                company_page(),
                {
                    "name": "subject",
                    "title": "Предмет лизинга",
                    "elements": [
                        {"type": "radiogroup", "name": "wagon_condition", "title": "Состояние вагонов", "isRequired": True,
                         "choices": [{"value": "new", "text": "Новые"}, {"value": "used", "text": "Бывшие в эксплуатации"}]},
                        {"type": "text", "inputType": "number", "name": "wagon_age", "title": "Возраст вагонов, лет", "min": 1, "max": 15,
                         "visibleIf": "{wagon_condition} = 'used'",
                         "description": "Для б/у вагонов — не более 15 лет"},
                        {"type": "dropdown", "name": "wagon_type", "title": "Тип вагонов", "isRequired": True,
                         "choices": ["Полувагоны", "Крытые вагоны", "Цистерны", "Платформы", "Хопперы"]},
                        {"type": "text", "inputType": "number", "name": "wagon_count", "title": "Количество вагонов, ед.", "isRequired": True, "min": 1, "max": 500},
                        {"type": "text", "inputType": "number", "name": "unit_price", "title": "Цена за вагон, ₸", "isRequired": True, "min": 5000000, "max": 100000000, "defaultValue": 28000000},
                    ],
                },
                {
                    "name": "terms",
                    "title": "Условия лизинга",
                    "elements": [
                        {"type": "text", "inputType": "number", "name": "lease_term", "title": "Срок лизинга, мес", "isRequired": True, "min": 12, "max": 120, "defaultValue": 84},
                        {"type": "text", "inputType": "number", "name": "advance_share", "title": "Авансовый платёж, %", "isRequired": True, "min": 15, "max": 50, "defaultValue": 20,
                         "validators": [{"type": "expression", "expression": "{advance_share} >= 15",
                                          "text": "Минимальный аванс по программе — 15%"}]},
                    ],
                },
                {
                    "name": "calc",
                    "title": "Расчёт",
                    "elements": [
                        {"type": "expression", "name": "total_cost", "title": "Стоимость предмета лизинга",
                         "expression": "{wagon_count} * {unit_price}", "displayStyle": "currency", "currency": "KZT"},
                        {"type": "expression", "name": "advance_amount", "title": "Авансовый платёж",
                         "expression": "{wagon_count} * {unit_price} * {advance_share} / 100", "displayStyle": "currency", "currency": "KZT"},
                        {"type": "expression", "name": "financed", "title": "Сумма финансирования",
                         "expression": "{wagon_count} * {unit_price} * (100 - {advance_share}) / 100", "displayStyle": "currency", "currency": "KZT"},
                        {"type": "expression", "name": "monthly", "title": "Ориентировочный платёж в месяц",
                         "expression": "{wagon_count} * {unit_price} * (100 - {advance_share}) / 100 / {lease_term}", "displayStyle": "currency", "currency": "KZT"},
                    ],
                },
                # --- II этап: расширенные данные и документы (stage=2) ---
                {
                    "name": "extended",
                    "title": "Дополнительные сведения и документы",
                    "stage": 2,
                    "description": "Заполняется после принятия первичной заявки для передачи в BPM-систему БРК-Лизинг.",
                    "elements": [
                        {"type": "html", "name": "stage2_intro", "html": "<div style='padding:8px 12px;background:#fff5e6;border-radius:8px;color:#8a5a10;font-size:13px'>Первичная заявка принята. Предоставьте финансовые показатели и документы по предмету лизинга и поставщику.</div>"},
                        {"type": "text", "inputType": "number", "name": "annual_revenue", "title": "Выручка за последний год, ₸", "isRequired": True, "min": 0},
                        {"type": "boolean", "name": "has_existing_leasing", "title": "Есть ли действующие договоры лизинга?"},
                        {"type": "text", "inputType": "number", "name": "existing_leasing_amount", "title": "Остаток обязательств по лизингу, ₸", "min": 0,
                         "visibleIf": "{has_existing_leasing} = true"},
                        {"type": "dropdown", "name": "collateral_type", "title": "Дополнительное обеспечение", "isRequired": True,
                         "choices": [{"value": "wagons", "text": "Приобретаемые вагоны"}, {"value": "realestate", "text": "Недвижимость"}, {"value": "guarantee", "text": "Гарантия"}, {"value": "deposit", "text": "Денежный депозит"}]},
                        {"type": "text", "name": "supplier_name", "title": "Поставщик / производитель вагонов", "isRequired": True},
                        {"type": "text", "name": "supply_contract_no", "title": "№ договора поставки"},
                        {"type": "boolean", "name": "tech_passport", "title": "Есть технические паспорта на вагоны?", "defaultValue": True},
                        {"type": "comment", "name": "stage2_note", "title": "Дополнительная информация для эксперта"},
                    ],
                },
            ],
        },
    },
]


def seed_services() -> None:
    seed_reference_data()
    client = TestClient(app)
    client.cookies.set(
        settings.session_cookie,
        encode_session(
            SessionUser(id="seed-admin", name="Seed Admin", role="admin")
        ),
    )

    existing = {s["slug"] for s in client.get("/api/v1/admin/services").json()}
    created = 0
    for spec in SERVICES:
        slug = spec["create"]["slug"]
        if slug in existing:
            print(f"  · {slug} — уже есть, пропуск")
            continue

        # 1) create (constructor: card wizard step 1)
        r = client.post("/api/v1/admin/services", json=spec["create"])
        r.raise_for_status()
        sid = r.json()["id"]

        # 2) PATCH card fields
        client.patch(f"/api/v1/admin/services/{sid}", json=spec["card"]).raise_for_status()

        # 3) PUT form schema (creates version 2, draft)
        client.put(
            f"/api/v1/admin/services/{sid}/form",
            json={"schema": spec["schema"], "author": "Сид-скрипт (конструктор)"},
        ).raise_for_status()

        # 4) publish latest
        client.post(f"/api/v1/admin/services/{sid}/publish", json={}).raise_for_status()
        created += 1
        print(f"  ✓ {slug} — создана через конструктор и опубликована")

    print(f"Готово: {created} услуг создано, {len(existing)} уже было.")


if __name__ == "__main__":
    seed_services()
