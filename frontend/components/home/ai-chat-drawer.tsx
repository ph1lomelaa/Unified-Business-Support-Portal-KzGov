"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Calculator,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import type { DictKey } from "@/i18n/dictionaries";

type CardType = "service" | "knowledge" | "calculator";

type ChatCard = {
  type: CardType;
  slug: string;
  title: string;
  summary?: string;
  org?: string;
  href: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  cards?: ChatCard[];
  source?: "ai" | "fallback";
};

type ChatResponse = {
  reply: string;
  cards: ChatCard[];
  source: "ai" | "fallback";
  suggestions: string[];
};

const STORAGE_KEY = "eppb_ai_chat";
const DEFAULT_SUGGESTIONS = [
  "Какая мера поддержки мне подходит?",
  "Какие документы нужны для заявки?",
  "Сравни субсидирование и кредитование",
];

export function AiChatDrawer() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = React.useState(DEFAULT_SUGGESTIONS);
  const restored = React.useRef(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-24));
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      restored.current = true;
    }
  }, []);

  React.useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)));
    } catch {
      // sessionStorage can be unavailable in private browsing; chat still works.
    }
  }, [messages]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflowX = document.body.style.overflowX;
    document.body.style.overflowX = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflowX = previousOverflowX;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const sendMessage = React.useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || loading) return;
      const userMessage: ChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMessage].slice(-24);
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      const body = {
        messages: nextMessages.map((item) => ({ role: item.role, content: item.content })),
      };
      const requestOnce = () => api<ChatResponse>("/api/ai/chat", { method: "POST", json: body });
      try {
        let response: ChatResponse;
        try {
          response = await requestOnce();
        } catch {
          // одна повторная попытка — гасит редкие сбои холодного старта/таймаута
          await new Promise((resolve) => setTimeout(resolve, 700));
          response = await requestOnce();
        }
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: response.reply,
            cards: response.cards,
            source: response.source,
          },
        ]);
        if (response.suggestions?.length) setSuggestions(response.suggestions);
      } catch {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: t("ai.chat.error") },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, t]
  );

  const clearChat = React.useCallback(() => {
    setMessages([]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setInput("");
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sessionStorage может быть недоступен в приватном режиме — чат всё равно очищен
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex size-[60px] items-center justify-center rounded-full bg-brand-green text-white shadow-[var(--shadow-pop)] hover:bg-brand-green-hover",
          open && "hidden"
        )}
        aria-label={t("ai.chat.open")}
      >
        <Bot size={28} strokeWidth={1.75} />
        <span className="absolute -top-8 right-0 whitespace-nowrap rounded-full bg-[#0a3a22] px-3 py-1 text-[12px] font-semibold text-white shadow-[var(--shadow-pop)]">
          Помощник
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-ink/40 sm:hidden"
            aria-label={t("ai.chat.close")}
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col overflow-hidden border-l border-border bg-surface shadow-[var(--shadow-pop)] sm:w-[420px]">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{t("ai.chat.title")}</p>
                <p className="truncate text-[12px] text-muted">{t("ai.chat.subtitle")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={clearChat}
                  disabled={messages.length === 0}
                  className="flex size-10 items-center justify-center rounded-control border border-border text-muted hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Очистить чат"
                  title="Очистить чат"
                >
                  <Trash2 size={17} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-10 items-center justify-center rounded-control border border-border text-muted hover:text-ink"
                  aria-label={t("ai.chat.close")}
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
            </header>

            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4"
            >
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[14px] leading-relaxed text-muted">{t("ai.chat.empty")}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => sendMessage(item)}
                        className="max-w-full rounded-full border border-border px-3 py-1.5 text-left text-[13px] font-medium text-ink hover:border-brand-green hover:text-brand-green"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <MessageBubble key={`${message.role}-${index}`} message={message} t={t} />
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-card border border-border bg-bg px-3 py-2 text-[13px] text-muted">
                    {t("ai.chat.typing")}
                  </div>
                </div>
              )}
            </div>

            {messages.length > 0 && suggestions.length > 0 && (
              <div className="shrink-0 border-t border-border bg-bg/60 px-4 py-2">
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => sendMessage(item)}
                      className="max-w-full rounded-full border border-border bg-surface px-3 py-1.5 text-left text-[12px] font-medium text-ink hover:border-brand-green hover:text-brand-green"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              className="flex shrink-0 items-end gap-2 border-t border-border bg-surface p-3"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                placeholder={t("ai.chat.placeholder")}
                className="max-h-28 min-h-[48px] min-w-0 flex-1 resize-none rounded-control border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted focus:border-ink"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex size-12 shrink-0 items-center justify-center rounded-control bg-brand-green text-white hover:bg-brand-green-hover disabled:pointer-events-none disabled:opacity-50"
                aria-label={t("ai.chat.send")}
              >
                <Send size={18} strokeWidth={1.75} />
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

function MessageBubble({ message, t }: { message: ChatMessage; t: (key: DictKey) => string }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%] space-y-2", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "break-words rounded-card px-3 py-2 text-[14px] leading-relaxed",
            isUser ? "whitespace-pre-wrap bg-brand-green text-white" : "border border-border bg-bg text-ink"
          )}
        >
          {isUser ? message.content : <Markdown text={message.content} />}
        </div>
        {!isUser && message.source === "fallback" && (
          <p className="px-1 text-[11px] font-medium text-muted">{t("ai.chat.fallback")}</p>
        )}
        {!isUser && message.cards?.length ? (
          <div className="w-full space-y-2">
            {message.cards.map((card) => (
              <ChatCardLink key={`${card.type}-${card.slug}`} card={card} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* Лёгкий безопасный markdown-рендер для ответов ассистента: **жирный**,
 * заголовки, маркированные и нумерованные списки, абзацы. Без dangerouslySetHTML
 * и без внешних зависимостей — только React-элементы. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const key = `list-${blocks.length}`;
    blocks.push(
      ordered ? (
        <ol key={key} className="my-1.5 ml-4 list-decimal space-y-1">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="my-1.5 ml-4 list-disc space-y-1">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push(
        <p key={`h-${blocks.length}`} className="mt-2 font-semibold text-ink">
          {renderInline(heading[1], `h${blocks.length}`)}
        </p>
      );
    } else if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
    } else if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else {
      flushList();
      blocks.push(
        <p key={`p-${blocks.length}`} className="[&:not(:first-child)]:mt-1.5">
          {renderInline(line, `p${blocks.length}`)}
        </p>
      );
    }
  }
  flushList();
  return <div className="space-y-0.5">{blocks}</div>;
}

function ChatCardLink({ card }: { card: ChatCard }) {
  const Icon =
    card.type === "service"
      ? BriefcaseBusiness
      : card.type === "knowledge"
        ? BookOpen
        : Calculator;
  return (
    <Link
      href={card.href}
      className="flex w-full min-w-0 gap-3 overflow-hidden rounded-control border border-border bg-surface p-3 text-left hover:border-brand-green"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-st-green-bg text-brand-green">
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">{card.title}</span>
        {card.org && <span className="mt-0.5 block truncate text-[11px] text-muted">{card.org}</span>}
        {card.summary && (
          <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-muted">
            {card.summary}
          </span>
        )}
      </span>
    </Link>
  );
}
