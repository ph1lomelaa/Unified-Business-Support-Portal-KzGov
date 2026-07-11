// Встроенные в wizard AI-помощники (spec 6.6, items 3–5).
//
// Три помощника, все НЕблокирующие (никогда не мешают перейти на след. шаг):
//  • «?» под текстовым/выбираемым полем — объяснение поля простыми словами;
//  • проактивная подсказка при выборе «сложной» опции (radiogroup/dropdown);
//  • мягкая AI-проверка текстового поля при потере фокуса (onBlur): «Похоже,
//    здесь опечатка…» с кнопкой «Исправить» (только предложение — правку
//    применяет пользователь).
//
// Почему прямой DOM, а не React: SurveyJS сам рендерит поля. Точка расширения
// onAfterRenderQuestion даёт узел вопроса — мы дорисовываем слот подсказки СРАЗУ
// под полем. Слот идемпотентен (не дублируется на ре-рендерах), состояние живёт
// в Map по имени поля, поэтому переживает перерисовку. AI-вызовы асинхронные,
// с AbortController на поле — устаревшие ответы отбрасываются.

import type { Model, Question } from "survey-core";
import { api } from "@/lib/api";

type Ctx = { serviceId: string; serviceTitle: string };

type ValidateResp = {
  ok: boolean;
  severity: "ok" | "warn";
  message: string | null;
  suggestion: string | null;
  source: string;
};
type HelpResp = { hint: string | null; source: string };

type FieldState = {
  explain: { loading: boolean; text: string | null } | null;
  option: string | null; // проактивная подсказка по выбранной опции
  validation: { message: string; suggestion: string | null } | null;
};

const OPTION_TYPES = new Set(["radiogroup", "dropdown"]);
const HELP_TYPES = new Set(["text", "comment", "radiogroup", "dropdown"]);
// inputType, для которых уже есть маски/валидаторы — их не проверяем текстом.
const SKIP_INPUT = new Set(["number", "date", "datetime-local", "range", "tel", "time", "month", "week"]);

const CSS = {
  wrap: "margin-top:8px;display:flex;flex-direction:column;gap:6px;",
  ask: "align-self:flex-start;display:inline-flex;align-items:center;gap:5px;border:none;background:none;padding:0;cursor:pointer;color:#0B7A3E;font-size:12px;font-weight:600;",
  msgBase: "font-size:13px;line-height:1.45;border-radius:8px;padding:8px 10px;border:1px solid;",
  warn: "background:#FFF7E6;color:#8A5A10;border-color:#F3D98B;",
  option: "background:#E3F1EC;color:#0F6E56;border-color:#BFE3D3;",
  explain: "background:#F3F4F1;color:#4A4A4A;border-color:#E3E5DF;",
  fix: "margin-left:8px;border:1px solid #0B7A3E;background:#0B7A3E;color:#fff;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600;cursor:pointer;",
};

export function attachWizardAiHelp(model: Model, ctx: Ctx): () => void {
  const state = new Map<string, FieldState>();
  const slots = new Map<string, HTMLElement>(); // msgs-контейнер, привязанный сейчас
  const aborters = new Map<string, AbortController>();

  const get = (name: string): FieldState =>
    state.get(name) ?? { explain: null, option: null, validation: null };

  function abort(key: string) {
    aborters.get(key)?.abort();
    const ac = new AbortController();
    aborters.set(key, ac);
    return ac.signal;
  }

  // ---- рендер сообщений под конкретным полем ----
  function render(name: string) {
    const msgs = slots.get(name);
    if (!msgs || !msgs.isConnected) return;
    msgs.textContent = "";
    const s = get(name);

    if (s.explain) {
      msgs.appendChild(
        row(CSS.explain, s.explain.loading ? "Готовим подсказку…" : s.explain.text ?? "")
      );
    }
    if (s.option) msgs.appendChild(row(CSS.option, `💡 ${s.option}`));
    if (s.validation) {
      const el = row(CSS.warn, `Похоже, здесь ошибка: ${s.validation.message}`);
      if (s.validation.suggestion) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText = CSS.fix;
        btn.textContent = "Исправить";
        btn.onclick = () => {
          model.setValue(name, s.validation!.suggestion);
          patch(name, { validation: null }); // правку применил пользователь
        };
        el.appendChild(btn);
      }
      msgs.appendChild(el);
    }
  }

  function row(style: string, text: string): HTMLElement {
    const div = document.createElement("div");
    div.style.cssText = CSS.msgBase + style;
    div.textContent = text; // textContent → AI-текст не исполняется как HTML
    return div;
  }

  function patch(name: string, part: Partial<FieldState>) {
    state.set(name, { ...get(name), ...part });
    render(name);
  }

  // ---- «?»: объяснение поля ----
  async function explain(name: string) {
    const cur = get(name).explain;
    if (cur?.loading || cur?.text) return; // уже есть — не дёргаем повторно
    patch(name, { explain: { loading: true, text: null } });
    try {
      const r = await api<HelpResp>("/api/ai/field-help", {
        method: "POST",
        signal: abort(`help:${name}`),
        json: { serviceId: ctx.serviceId, fieldName: name },
      });
      patch(name, { explain: { loading: false, text: r.hint ?? "Пояснение недоступно." } });
    } catch {
      patch(name, { explain: { loading: false, text: "Пояснение сейчас недоступно." } });
    }
  }

  // ---- проактивная подсказка при выборе опции ----
  async function optionHint(q: Question, value: unknown) {
    const name = q.name;
    if (value === undefined || value === null || value === "") {
      patch(name, { option: null });
      return;
    }
    const choice = (q as unknown as { choices?: { value: unknown; text?: string }[] }).choices?.find(
      (c) => String(c.value) === String(value)
    );
    try {
      const r = await api<HelpResp>("/api/ai/field-help", {
        method: "POST",
        signal: abort(`opt:${name}`),
        json: {
          serviceId: ctx.serviceId,
          fieldName: name,
          optionValue: String(value),
          optionText: choice?.text ?? String(value),
        },
      });
      patch(name, { option: r.hint ?? null });
    } catch {
      /* тихо: подсказка необязательна */
    }
  }

  // ---- onBlur: мягкая проверка текстового поля ----
  const lastChecked = new Map<string, string>();
  async function validate(q: Question, raw: string) {
    const name = q.name;
    const value = (raw ?? "").trim();
    if (!value || lastChecked.get(name) === value) return;
    lastChecked.set(name, value);
    try {
      const r = await api<ValidateResp>("/api/ai/validate-field", {
        method: "POST",
        signal: abort(`val:${name}`),
        json: {
          fieldName: name,
          value,
          serviceContext: { title: q.title, type: q.getType(), serviceTitle: ctx.serviceTitle },
        },
      });
      patch(name, { validation: r.ok ? null : { message: r.message ?? "проверьте значение", suggestion: r.suggestion } });
    } catch {
      /* сеть недоступна → просто не показываем подсказку (неблокирующе) */
    }
  }

  function canValidate(q: Question): boolean {
    if (q.getType() === "comment") return true;
    if (q.getType() !== "text") return false;
    const input = (q as unknown as { inputType?: string }).inputType;
    if (input && SKIP_INPUT.has(input)) return false;
    if (q.name === "bin") return false; // БИН уже под regex-маской
    const hasRegex = ((q as unknown as { validators?: { getType?: () => string }[] }).validators ?? []).some(
      (v) => v.getType?.() === "regexvalidator"
    );
    return !hasRegex;
  }

  // ---- дорисовка слота под каждым подходящим полем ----
  const onRender = (_s: Model, opt: { question: Question; htmlElement: HTMLElement }) => {
    const q = opt.question;
    const el = opt.htmlElement;
    if (!q?.name || !HELP_TYPES.has(q.getType())) return;
    if (el.querySelector(":scope > [data-ai-help]")) return; // уже дорисовано

    const wrap = document.createElement("div");
    wrap.setAttribute("data-ai-help", "");
    wrap.style.cssText = CSS.wrap;

    const ask = document.createElement("button");
    ask.type = "button";
    ask.style.cssText = CSS.ask;
    ask.textContent = "❓ Не понимаю это поле";
    ask.onclick = () => explain(q.name);
    wrap.appendChild(ask);

    const msgs = document.createElement("div");
    msgs.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    wrap.appendChild(msgs);
    try {
      el.appendChild(wrap);
    } catch {
      return;
    }
    slots.set(q.name, msgs);

    // onBlur-проверка текстовых полей
    if (canValidate(q)) {
      const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
      if (input && !input.dataset.aiBlur) {
        input.dataset.aiBlur = "1";
        input.addEventListener("blur", () => validate(q, input.value));
      }
    }
    render(q.name); // восстановить показанные ранее подсказки после ре-рендера
  };

  // ---- выбор опции → проактивная подсказка ----
  const onValue = (_s: Model, opt: { name: string; value: unknown; question?: Question }) => {
    const q = opt.question ?? model.getQuestionByName(opt.name);
    if (q && OPTION_TYPES.has(q.getType())) optionHint(q, opt.value);
  };

  model.onAfterRenderQuestion.add(onRender);
  model.onValueChanged.add(onValue);

  return () => {
    model.onAfterRenderQuestion.remove(onRender);
    model.onValueChanged.remove(onValue);
    aborters.forEach((a) => a.abort());
    slots.clear();
    state.clear();
  };
}
