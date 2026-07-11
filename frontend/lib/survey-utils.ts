// Helpers for working with SurveyJS schemas outside the runtime.

export type SchemaEl = {
  name?: string;
  type?: string;
  title?: string;
  elements?: SchemaEl[];
};
export type SchemaPage = {
  name?: string;
  title?: string;
  description?: string;
  /** stage 2 = расширенные данные, собираемые после первичной подачи (I этап). */
  stage?: number;
  elements?: SchemaEl[];
};
export type SurveySchema = { title?: string; pages?: SchemaPage[] };

/** Pages of the primary application (I этап) — everything not marked stage 2. */
export function stage1Pages(schema: SurveySchema): SchemaPage[] {
  return (schema.pages ?? []).filter((p) => p.stage !== 2);
}

/** Pages collected in the second stage (II этап), if any. */
export function stage2Pages(schema: SurveySchema): SchemaPage[] {
  return (schema.pages ?? []).filter((p) => p.stage === 2);
}

export function walkElements(schema: SurveySchema): SchemaEl[] {
  const out: SchemaEl[] = [];
  const walk = (els?: SchemaEl[]) => {
    (els ?? []).forEach((el) => {
      if (el.type === "panel") return walk(el.elements);
      out.push(el);
    });
  };
  (schema.pages ?? []).forEach((p) => walk(p.elements));
  return out;
}

export function expressionNames(schema: SurveySchema): Set<string> {
  return new Set(
    walkElements(schema)
      .filter((el) => el.type === "expression" && el.name)
      .map((el) => el.name as string)
  );
}

/** Split flat survey data into user answers vs computed (expression) values. */
export function splitAnswers(
  schema: SurveySchema,
  data: Record<string, unknown>
): { answers: Record<string, unknown>; calc: Record<string, unknown> } {
  const exprs = expressionNames(schema);
  const answers: Record<string, unknown> = {};
  const calc: Record<string, unknown> = {};
  Object.entries(data ?? {}).forEach(([k, v]) => {
    if (exprs.has(k)) calc[k] = v;
    else answers[k] = v;
  });
  return { answers, calc };
}

export function pageHasField(page: SchemaPage, name: string): boolean {
  const check = (els?: SchemaEl[]): boolean =>
    (els ?? []).some(
      (el) => el.name === name || (el.type === "panel" && check(el.elements))
    );
  return check(page.elements);
}
