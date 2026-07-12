"use client";

import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import {
  FileText,
  Info,
  ChevronDown,
  CircleDot,
  Download,
} from "lucide-react";
import type { ServiceFull } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/provider";

export function ServiceTabs({ service }: { service: ServiceFull }) {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="conditions">
      <TabsList>
        <TabsTrigger value="conditions">{t("service.tabs.conditions")}</TabsTrigger>
        <TabsTrigger value="documents">{t("service.tabs.documents")}</TabsTrigger>
        <TabsTrigger value="stages">{t("service.tabs.stages")}</TabsTrigger>
        {service.faq?.length > 0 && <TabsTrigger value="faq">{t("service.tabs.faq")}</TabsTrigger>}
      </TabsList>

      <TabsContent value="conditions" className="pt-5">
        <div className="space-y-3 text-[14px] leading-relaxed text-fg">
          {(service.description || "").split("\n").map((p, i) =>
            p.trim() ? <p key={i}>{p}</p> : null
          )}
        </div>
        {service.conditions?.length > 0 && (
          <div className="mt-5 space-y-2 text-[14px] text-ink">
            {service.conditions.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-4 gap-y-1 border-b border-border pb-2 last:border-b-0"
              >
                <span className="text-[13px] text-muted">{c.label}:</span>
                <span className="font-medium break-words">{c.value}</span>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="documents" className="pt-5">
        <ul className="space-y-2">
          {(service.documents ?? []).map((d, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-control border border-border bg-surface px-4 py-3"
            >
              <FileText size={20} strokeWidth={1.75} className="text-muted" />
              <span className="flex-1 text-[14px] text-fg">{d.name}</span>
              {d.auto ? (
                <span className="inline-flex items-center rounded-control bg-st-green-bg px-2 py-0.5 text-[12px] font-medium text-st-green">
                  {t("service.docs.auto")}
                </span>
              ) : d.condition ? (
                <span className="rounded-control bg-st-gray-bg px-2 py-0.5 text-[12px] font-medium text-muted">
                  {t("service.docs.conditionOnly")} {d.condition}
                </span>
              ) : (
                <span className="text-[12px] text-muted">{t("service.docs.manual")}</span>
              )}
            </li>
          ))}
        </ul>

        {service.materials?.length > 0 && (
          <div className="mt-6">
            <p className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted">
              {t("service.docs.materials")}
            </p>
            <ul className="mt-3 space-y-2">
              {service.materials.map((m, i) => (
                <li key={i}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 transition-colors hover:border-ink"
                  >
                    <Download size={20} strokeWidth={1.75} className="text-muted" />
                    <span className="flex-1 text-[14px] text-fg">{m.name}</span>
                    {m.size && <span className="text-[12px] text-muted">{m.size}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TabsContent>

      <TabsContent value="stages" className="pt-5">
        <Stepper reviewDays={service.reviewDays} />
      </TabsContent>

      {service.faq?.length > 0 && (
        <TabsContent value="faq" className="pt-5">
          <Accordion.Root
            type="single"
            collapsible
            className="rounded-card border border-border bg-surface"
          >
            {service.faq.map((f, i) => (
              <Accordion.Item
                key={i}
                value={`f${i}`}
                className="border-b border-border last:border-b-0"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-medium text-fg">
                    {f.q}
                    <ChevronDown
                      size={18}
                      strokeWidth={1.75}
                      className="shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180"
                    />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="px-4 pb-4 text-[14px] text-muted">
                  {f.a}
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </TabsContent>
      )}
    </Tabs>
  );
}

function Stepper({ reviewDays }: { reviewDays: number }) {
  const { t } = useI18n();
  const nodes = [
    { title: t("service.stage.apply"), sub: t("service.stage.applyTime") },
    { title: t("service.stage.review"), sub: `${reviewDays} ${t("common.workDays")}` },
    { title: t("service.stage.decision"), sub: t("service.stage.decisionSub") },
    { title: t("service.stage.contract"), sub: "" },
  ];
  return (
    <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
      {nodes.map((n, i) => (
        <li key={i} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
          <div className="flex items-center sm:w-full">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface text-[13px] font-semibold text-ink">
              {i + 1}
            </span>
            {i < nodes.length - 1 && (
              <span className="hidden h-0.5 flex-1 bg-border sm:block" />
            )}
          </div>
          <div className="sm:mt-2">
            <p className="text-[14px] font-medium text-ink">{n.title}</p>
            {n.sub && <p className="text-[12px] text-muted">{n.sub}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ConditionPills({
  conditions,
}: {
  conditions: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {conditions.slice(0, 4).map((c, i) => (
        <div
          key={i}
          className="min-w-[175px] flex-1 rounded-full border border-border bg-bg px-4 py-3 text-sm text-ink"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {c.label}
          </p>
          <p className="mt-1 font-semibold leading-tight">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export { CircleDot, Info };
