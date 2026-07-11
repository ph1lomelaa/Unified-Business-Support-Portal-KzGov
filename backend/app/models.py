"""SQLModel tables — mirror of spec Часть 2 (8 tables).

Fields are camelCase to match the spec's Prisma schema and the TypeScript
frontend contract exactly (single owner of both sides -> no alias layer).
JSON columns hold structured data (conditions, form schema, answers, ...).
"""

from datetime import datetime, timezone
from secrets import token_hex

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel


def gen_id(prefix: str = "") -> str:
    return f"{prefix}{token_hex(10)}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(SQLModel, table=True):
    id: str = Field(primary_key=True)  # "damu", "akk", ...
    name: str
    shortName: str
    logo: str = ""
    color: str = "#121517"

    services: list["Service"] = Relationship(back_populates="organization")


class Service(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("svc_"), primary_key=True)
    slug: str = Field(index=True, unique=True)
    orgId: str = Field(foreign_key="organization.id", index=True)
    title: str
    category: str  # credit|subsidy|guarantee|leasing|insurance|investment
    summary: str = ""
    description: str = ""
    conditions: list = Field(default_factory=list, sa_column=Column(JSON))
    documents: list = Field(default_factory=list, sa_column=Column(JSON))
    # Reference materials published by the program (rules PDF, presentation deck,
    # ...) — distinct from `documents`, which is what the applicant must submit.
    materials: list = Field(default_factory=list, sa_column=Column(JSON))
    eligibility: dict = Field(default_factory=dict, sa_column=Column(JSON))
    faq: list = Field(default_factory=list, sa_column=Column(JSON))
    tags: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = "draft"  # draft|published|archived
    reviewDays: int = 5
    docTemplate: str = ""
    createdAt: datetime = Field(default_factory=utcnow)
    updatedAt: datetime = Field(default_factory=utcnow)

    organization: Organization | None = Relationship(back_populates="services")
    formSchemas: list["FormSchema"] = Relationship(
        back_populates="service",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class FormSchema(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("fs_"), primary_key=True)
    serviceId: str = Field(foreign_key="service.id", index=True)
    version: int = 1
    schema: dict = Field(default_factory=dict, sa_column=Column(JSON))
    isActive: bool = False
    author: str = "Аналитик"
    createdAt: datetime = Field(default_factory=utcnow)

    service: Service | None = Relationship(back_populates="formSchemas")


class Company(SQLModel, table=True):
    bin: str = Field(primary_key=True)
    name: str
    form: str  # IP | TOO
    oked: str
    okedName: str
    address: str
    region: str
    director: str
    category: str  # micro|small|medium|large


class CompanyProfile(SQLModel, table=True):
    companyBin: str = Field(foreign_key="company.bin", primary_key=True)
    email: str = ""
    phone: str = ""
    notifyEmail: bool = True
    updatedAt: datetime = Field(default_factory=utcnow)


class Application(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("app_"), primary_key=True)
    number: str = Field(index=True, unique=True)
    serviceId: str = Field(foreign_key="service.id", index=True)
    companyBin: str = Field(index=True)
    status: str = "draft"
    answers: dict = Field(default_factory=dict, sa_column=Column(JSON))
    calc: dict = Field(default_factory=dict, sa_column=Column(JSON))
    pdfUrl: str | None = None
    files: list = Field(default_factory=list, sa_column=Column(JSON))
    schemaSnapshot: dict = Field(default_factory=dict, sa_column=Column(JSON))
    createdAt: datetime = Field(default_factory=utcnow)
    updatedAt: datetime = Field(default_factory=utcnow)

    events: list["ApplicationEvent"] = Relationship(
        back_populates="application",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "ApplicationEvent.createdAt",
        },
    )


class ApplicationEvent(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("evt_"), primary_key=True)
    appId: str = Field(foreign_key="application.id", index=True)
    fromStatus: str | None = None  # 'from' is a Python keyword
    toStatus: str
    comment: str | None = None
    actor: str = "system"  # system|manager|client
    createdAt: datetime = Field(default_factory=utcnow)

    application: Application | None = Relationship(back_populates="events")


class AuditLog(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("aud_"), primary_key=True)
    actor: str
    actorRole: str
    action: str = Field(index=True)
    entityType: str = Field(index=True)
    entityId: str = Field(index=True)
    meta: dict = Field(default_factory=dict, sa_column=Column(JSON))
    createdAt: datetime = Field(default_factory=utcnow, index=True)


class Notification(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("ntf_"), primary_key=True)
    userBin: str = Field(index=True)
    title: str
    body: str
    appId: str | None = None
    kind: str = "status"  # status|documents|news
    read: bool = False
    createdAt: datetime = Field(default_factory=utcnow)


class KnowledgeItem(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("kn_"), primary_key=True)
    slug: str = Field(index=True, unique=True)
    type: str  # article|template|checklist|calculator|guide
    title: str
    summary: str = ""
    body: str = ""  # markdown-lite: "## " headers, "- " bullets, blank-line paragraphs
    readMinutes: int = 5
    relatedServiceSlugs: list = Field(default_factory=list, sa_column=Column(JSON))
    downloadRef: str | None = None  # slug used by the PDF download endpoint
    updatedAt: datetime = Field(default_factory=utcnow)


class NewsItem(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("news_"), primary_key=True)
    sourceOrgId: str = Field(foreign_key="organization.id", index=True)
    title: str
    summary: str = ""
    publishedAt: datetime = Field(index=True)
    sourceUrl: str = Field(index=True, unique=True)
    imageUrl: str | None = None
    importedAt: datetime = Field(default_factory=utcnow, index=True)
    status: str = Field(default="draft", index=True)  # draft|published


class FaqEntry(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("faq_"), primary_key=True)
    question: str
    answer: str
    order: int = 0


class User(SQLModel, table=True):
    id: str = Field(primary_key=True)
    role: str  # entrepreneur|analyst|admin
    name: str
    bin: str | None = None
    orgId: str | None = None


class OfficialSource(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    baseUrl: str
    kind: str
    adapterType: str
    status: str = "planned"  # ready|degraded|blocked|planned
    scheduleCron: str = "0 */6 * * *"
    robotsSnapshot: dict = Field(default_factory=dict, sa_column=Column(JSON))
    lastRunAt: datetime | None = None
    lastSuccessAt: datetime | None = None
    consecutiveFailures: int = 0


class OfficialImportRun(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("run_"), primary_key=True)
    sourceId: str = Field(foreign_key="officialsource.id", index=True)
    startedAt: datetime = Field(default_factory=utcnow)
    finishedAt: datetime | None = None
    status: str = "running"  # running|success|partial|failed
    found: int = 0
    changed: int = 0
    skippedRobots: int = 0
    errors: list = Field(default_factory=list, sa_column=Column(JSON))


class RawDocument(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("doc_"), primary_key=True)
    sourceId: str = Field(index=True)
    url: str = Field(index=True)
    fetchedAt: datetime = Field(default_factory=utcnow)
    contentHash: str = Field(index=True)
    etag: str | None = None
    lastModified: str | None = None
    rawTextRef: str


class ImportedService(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("imp_"), primary_key=True)
    sourceId: str = Field(index=True)
    docId: str = Field(foreign_key="rawdocument.id")
    orgId: str | None = Field(default=None, foreign_key="organization.id")
    serviceSlug: str | None = None
    title: str
    sourceUrl: str
    status: str = "imported"
    confidence: float = 0
    draftPayload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    supersedesId: str | None = None
    updatedAt: datetime = Field(default_factory=utcnow)


class ExtractedEvidence(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("ev_"), primary_key=True)
    importedServiceId: str = Field(foreign_key="importedservice.id", index=True)
    kind: str
    label: str
    value: str
    sourceQuote: str
    mappedTo: str
    confidence: float


# --- Integration bus (Фаза 1) -------------------------------------------------
# The portal never talks to an external system directly. Every outbound/inbound
# exchange goes through `app.integration.bus.call()`, which looks up the system
# + operation config from these tables and dispatches to a pluggable adapter.
# Everything below is admin-editable (no-code): add a system, edit its mock
# dataset, and the prefill/submit/sign flows change without touching code.


class IntegrationSystem(SQLModel, table=True):
    id: str = Field(primary_key=True)  # "gbd-ul", "holding-esb", "egov-idp", ...
    name: str
    owner: str = ""
    purpose: str = ""
    kind: str = "external"  # external|internal|bus
    adapterType: str = "mock"  # mock|rest|oidc|eds|esb — selects the adapter
    baseUrl: str = ""
    authType: str = "none"  # none|apikey|oidc
    authSecret: str = ""  # api key / client secret (demo: plain)
    timeoutMs: int = 6000
    retryPolicy: dict = Field(default_factory=dict, sa_column=Column(JSON))  # {maxAttempts, backoffMs}
    status: str = "mocked"  # ready|mocked|degraded|planned
    sla: str = ""
    latencyMs: int | None = None  # simulated latency for the mock adapter
    nextStep: str = ""
    createdAt: datetime = Field(default_factory=utcnow)
    updatedAt: datetime = Field(default_factory=utcnow)

    operations: list["IntegrationOperation"] = Relationship(
        back_populates="system",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class IntegrationOperation(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("iop_"), primary_key=True)
    systemId: str = Field(foreign_key="integrationsystem.id", index=True)
    code: str = Field(index=True)  # "company.prefill", "application.submit", ...
    title: str = ""
    method: str = "POST"
    path: str = ""  # "/company/{bin}" — {tokens} filled from payload for REST
    direction: str = "outbound"  # outbound|inbound
    requestSchema: dict = Field(default_factory=dict, sa_column=Column(JSON))
    responseSchema: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # Admin-editable mock response. `{"resolver": "<name>"}` delegates to a
    # registered Python resolver (e.g. company lookup); otherwise returned as-is.
    mockDataset: dict = Field(default_factory=dict, sa_column=Column(JSON))
    latencyMs: int | None = None

    system: IntegrationSystem | None = Relationship(back_populates="operations")


class IntegrationContract(SQLModel, table=True):
    id: str = Field(default_factory=lambda: gen_id("ict_"), primary_key=True)
    systemId: str | None = Field(default=None, foreign_key="integrationsystem.id")
    operation: str = ""
    request: str = ""
    response: str = ""
    source: str = ""
    owner: str = ""


class IntegrationCall(SQLModel, table=True):
    """Outbox + live exchange log — every bus.call() writes one row."""

    id: str = Field(default_factory=lambda: gen_id("icl_"), primary_key=True)
    systemId: str = Field(index=True)
    operation: str = Field(index=True)
    direction: str = "outbound"
    idempotencyKey: str | None = Field(default=None, index=True)
    status: str = "success"  # success|error|retrying
    attempts: int = 1
    latencyMs: int | None = None
    requestPayload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    responsePayload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    application: str | None = None
    createdAt: datetime = Field(default_factory=utcnow, index=True)
