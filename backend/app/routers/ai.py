from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from ..ai.assist import field_help, validate_field
from ..ai.chat import chat
from ..ai.client import ai_status
from ..ai.construct import audit_schema, suggest_branching, suggest_fields
from ..ai.generate import AiError, generate_service
from ..ai.navigate import navigate, warmup_navigation
from ..ai.review import check_application
from ..audit_log import record_audit
from ..db import get_session
from ..models import FormSchema, Organization, Service
from ..schema_stages import split_schema_by_stage
from ..session import SessionUser, require_role
from ..slugify import slugify
from .admin_services import _unique_slug

router = APIRouter(prefix="/api/ai", tags=["ai"])


class NavigateBody(BaseModel):
    query: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatBody(BaseModel):
    messages: list[ChatMessage] = []


class GenerateBody(BaseModel):
    text: str
    orgId: str


@router.get("/status")
def status():
    return ai_status()


@router.post("/warmup")
def warmup(
    _user: SessionUser = Depends(require_role("admin")),
    db: Session = Depends(get_session),
):
    return {"ai": ai_status(force=True), "navigation": warmup_navigation(db)}


@router.post("/navigate")
def ai_navigate(body: NavigateBody, db: Session = Depends(get_session)):
    return navigate(db, body.query)


@router.post("/chat")
def ai_chat(body: ChatBody, db: Session = Depends(get_session)):
    messages = []
    for item in body.messages[-12:]:
        role = item.role.strip()
        content = item.content.strip()
        if role not in {"user", "assistant"} or not content:
            continue
        messages.append({"role": role, "content": content[:2000]})
    return chat(db, messages)


class CheckBody(BaseModel):
    serviceId: str
    answers: dict = {}


@router.post("/check-application")
def ai_check_application(body: CheckBody, db: Session = Depends(get_session)):
    """Проверка полноты/корректности заявки перед подписанием. Проверяем только
    страницы I этапа — расширенные данные собираются позже (см. многоэтапность)."""
    fs = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == body.serviceId, FormSchema.isActive == True)  # noqa: E712
        .order_by(FormSchema.version.desc())
    ).first()
    schema = fs.schema if fs else {"pages": []}
    stage1, _ = split_schema_by_stage(schema)
    return check_application({"pages": stage1}, body.answers)


class ValidateFieldBody(BaseModel):
    fieldName: str
    value: str = ""
    serviceContext: dict = {}


@router.post("/validate-field")
def ai_validate_field(body: ValidateFieldBody):
    """Мягкая AI-проверка текстового поля при потере фокуса (spec 6.6, item 4).
    Асинхронная и неблокирующая: только информирует, не мешает переходу по шагам.
    Без ключа — офлайн regex/эвристика того же формата ответа."""
    return validate_field(body.fieldName, body.value, body.serviceContext or {})


class FieldHelpBody(BaseModel):
    serviceId: str
    fieldName: str
    optionValue: str | None = None
    optionText: str | None = None


@router.post("/field-help")
def ai_field_help(body: FieldHelpBody, db: Session = Depends(get_session)):
    """Подсказка по полю wizard (spec 6.6, item 3): объяснение поля («?») или
    проактивная реакция на выбор сложной опции (передан optionValue)."""
    return field_help(
        db, body.serviceId, body.fieldName, body.optionValue, body.optionText
    )


class SuggestFieldsBody(BaseModel):
    serviceId: str


@router.post("/suggest-fields")
def ai_suggest_fields(body: SuggestFieldsBody, db: Session = Depends(get_session)):
    """Точечная помощь в конструкторе (spec REQ-22 доп.): типовой набор полей по
    названию/категории услуги. Только предложение — применяет человек."""
    return suggest_fields(db, body.serviceId)


class SuggestBranchingBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    serviceId: str
    fieldName: str
    # alias "schema" на проводе; имя поля другое, чтобы не тенить BaseModel.schema
    formSchema: dict = Field(default_factory=dict, alias="schema")


@router.post("/suggest-branching")
def ai_suggest_branching(body: SuggestBranchingBody, db: Session = Depends(get_session)):
    """Вероятные правила visibleIf для полей, связанных с выбранным полем-выбором.
    Только предложение с явным подтверждением на фронте."""
    return suggest_branching(db, body.serviceId, body.fieldName, body.formSchema or {})


class AuditSchemaBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    formSchema: dict = Field(default_factory=dict, alias="schema")


@router.post("/audit-schema")
def ai_audit_schema(body: AuditSchemaBody):
    """«Проверь форму на дыры» — список проблем схемы (обязательные поля,
    идентификатор, документы, битые условия). Claude при ключе, иначе эвристики."""
    return audit_schema(body.formSchema or {})


@router.post("/generate-service")
def ai_generate_service(
    body: GenerateBody,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    org = db.get(Organization, body.orgId)
    if not org:
        raise HTTPException(404, "Организация не найдена")
    if user.role == "analyst" and user.orgId != org.id:
        raise HTTPException(403, "Аналитик может создавать услуги только своей организации")
    try:
        result = generate_service(body.text)
    except AiError as e:
        raise HTTPException(422, str(e))

    card = result["card"]
    form = result["form"]
    slug = _unique_slug(db, f"{org.id}-{slugify(card['title'])}")
    service = Service(
        slug=slug,
        orgId=org.id,
        title=card["title"],
        category=card.get("category", "subsidy"),
        summary=card.get("summary", ""),
        conditions=card.get("conditions", []),
        documents=card.get("documents", []),
        status="draft",
    )
    db.add(service)
    db.flush()
    db.add(
        FormSchema(
            serviceId=service.id,
            version=1,
            schema=form,
            isActive=False,
            author="AI-генерация из текста",
        )
    )
    rules = result.get("extracted_rules", [])
    confidence_values = [
        item.get("confidence")
        for item in rules
        if isinstance(item, dict) and isinstance(item.get("confidence"), (int, float))
    ]
    confidence = (
        round(sum(confidence_values) / len(confidence_values), 3)
        if confidence_values
        else result.get("confidence", 0)
    )
    record_audit(
        db,
        user=user,
        action="ai.generation_used",
        entity_type="service",
        entity_id=service.id,
        meta={
            "serviceId": service.id,
            "title": service.title,
            "promptType": "service_from_text",
            "sources": len(rules),
            "confidence": confidence,
            "generated": "Карточка услуги и первичная FormSchema",
            "source": "Вставленный аналитиком текст",
        },
    )
    db.commit()
    db.refresh(service)
    return {
        "id": service.id,
        "slug": service.slug,
        "extractedRules": result.get("extracted_rules", []),
    }
