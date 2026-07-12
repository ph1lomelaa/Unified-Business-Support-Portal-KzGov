// Сохранение состояния AI-навигатора в рамках сессии (spec 6.6, items 1–2).
//
// Зачем: навигатор — клиентский компонент. Когда пользователь уходит из
// результата подбора в карточку услуги/каталог и возвращается на главную (или
// жмёт «назад»), компонент перемонтируется и по умолчанию обнулился бы в пустое
// поле. sessionStorage хранит последний запрос + результаты, поэтому возврат
// показывает те же рекомендации, а не пустую форму. Scope — вкладка/сессия:
// новая вкладка стартует чисто, что и нужно.

import type { ServiceCard } from "@/lib/types";

export type NavRecommendation = {
  service: ServiceCard;
  reason: string;
  evidence?: Array<{ label: string; value: string }>;
};

export type NavResult = {
  recommendations: NavRecommendation[];
  clarify: string | null;
  source: "ai" | "fallback";
  cached?: boolean;
};

export type NavSnapshot = { query: string; result: NavResult };

const KEY = "eppb_navigator";

export function loadNavSnapshot(): NavSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NavSnapshot>;
    if (
      typeof parsed?.query === "string" &&
      parsed.result &&
      Array.isArray(parsed.result.recommendations)
    ) {
      return { query: parsed.query, result: parsed.result as NavResult };
    }
  } catch {
    /* повреждённый/недоступный storage → как будто снимка нет */
  }
  return null;
}

export function saveNavSnapshot(snapshot: NavSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* приватный режим / переполнение — молча игнорируем */
  }
}

export function clearNavSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
