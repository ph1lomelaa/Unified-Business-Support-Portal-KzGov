// Shared API contract types (camelCase, mirror backend responses).

export type KnowledgeType = "article" | "template" | "checklist" | "calculator" | "guide";

export type KnowledgeCard = {
  id: string;
  slug: string;
  type: KnowledgeType;
  title: string;
  summary: string;
  readMinutes: number;
  relatedServiceSlugs: string[];
  downloadRef: string | null;
};

export type KnowledgeDetail = KnowledgeCard & {
  body: string;
  updatedAt: string;
};

export type PortalFaqItem = { question: string; answer: string };

export type OrgBrief = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo?: string | null;
  serviceCount?: number;
};

export type Condition = { label: string; value: string };
export type ServiceDoc = { name: string; auto?: boolean; condition?: string };

export type ServiceCard = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  conditions: Condition[];
  reviewDays: number;
  tags: ServiceTags;
  status: string;
  org: OrgBrief | null;
};

export type ServiceTags = {
  bizSize?: string[];
  industries?: string[];
  regions?: string[];
};

export type Region = { id: string; name: string };

export type ServiceFacets = { all: number; byCategory: Record<string, number> };

export type CompanyLookup = {
  bin: string;
  name: string;
  oked: string;
  okedName: string;
  region: string;
  industryHint: string;
  regionHint: string | null;
};

export type EligibilityQuestion = {
  id: string;
  q: string;
  opts: string[];
};
export type EligibilityRule = {
  if: Record<string, string[]>;
  verdict: "yes" | "no";
  why?: string;
  alt?: string;
};
export type Eligibility = {
  questions?: EligibilityQuestion[];
  rules?: EligibilityRule[];
  default?: "yes" | "no";
};

export type FaqItem = { q: string; a: string };

// Reference materials published by the program (rules PDF, presentation
// deck, ...) — distinct from `documents`, which is what the applicant submits.
export type ServiceMaterial = { name: string; url: string; mime?: string; size?: string };

export type ServiceFull = ServiceCard & {
  description: string;
  documents: ServiceDoc[];
  materials: ServiceMaterial[];
  eligibility: Eligibility;
  faq: FaqItem[];
  docTemplate: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any | null;
};

export type RegistryRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  reviewDays: number;
  formVersion: number;
  activeVersion: number | null;
  applications: number;
  updatedAt: string;
  org: { id: string; shortName: string; color: string; name: string } | null;
};

export type FormVersion = {
  version: number;
  author: string;
  isActive: boolean;
  createdAt: string;
};

export type ServiceEditor = {
  id: string;
  slug: string;
  orgId: string;
  org: OrgBrief | null;
  title: string;
  category: string;
  summary: string;
  description: string;
  conditions: Condition[];
  documents: ServiceDoc[];
  eligibility: Eligibility;
  faq: FaqItem[];
  tags: ServiceTags;
  status: string;
  reviewDays: number;
  docTemplate: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  activeVersion: number | null;
  latestVersion: number;
  versions: FormVersion[];
};

export type Company = {
  bin: string;
  name: string;
  form: string;
  oked: string;
  okedName: string;
  address: string;
  region: string;
  director: string;
  category: string;
  source?: string;
};

export const CATEGORY_LABEL: Record<string, string> = {
  credit: "Кредитование",
  subsidy: "Субсидирование",
  guarantee: "Гарантирование",
  leasing: "Лизинг",
  insurance: "Страхование",
  investment: "Инвестиции",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL);

// ---- applications ----
export type AppOrg = { shortName: string; name: string; color: string; logo?: string | null };

export type AppListItem = {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  service: { title: string; slug: string; reviewDays: number } | null;
  org: AppOrg | null;
};

export type AppDetail = {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  answers: Record<string, unknown>;
  calc: Record<string, unknown>;
  pdfUrl: string | null;
  files: { name: string; url: string; uploadedAt: string }[];
  createdAt: string;
  updatedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  stage2?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pages: any[];
    pending: boolean;
  } | null;
  service: { title: string; slug: string; reviewDays: number; category?: string } | null;
  org: (AppOrg & { id?: string }) | null;
  company: {
    name: string;
    bin: string;
    director?: string;
    region?: string;
    address?: string;
  };
  events: import("./status").AppEvent[];
  sla?: import("./status").SlaProgress | null;
};

export type QueueItem = {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  sla: import("./status").SlaProgress | null;
  company: { name: string; bin: string } | null;
  service: { title: string; slug: string } | null;
  org: AppOrg | null;
};
