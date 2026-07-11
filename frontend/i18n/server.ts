import { cookies } from "next/headers";
import { DEFAULT_LOCALE, dict, type DictKey, type Locale } from "./dictionaries";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("locale")?.value === "kk" ? "kk" : DEFAULT_LOCALE;
}

/** Server-component equivalent of useI18n().t — reads the locale cookie directly. */
export async function getT(): Promise<(key: DictKey) => string> {
  const locale = await getServerLocale();
  return (key: DictKey) => dict[locale][key] ?? dict.ru[key] ?? key;
}
