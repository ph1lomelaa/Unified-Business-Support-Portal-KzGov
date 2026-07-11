"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { OrgBrief } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

// REQ-22 / Часть 17: текст программы → AI → ЧЕРНОВИК в конструкторе.
// После генерации услуга открывается в визуальном редакторе для доводки —
// публикует человек.
export function GenerateServiceDialog({
  orgs,
  children,
}: {
  orgs: OrgBrief[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [orgId, setOrgId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setOrgId(orgs[0]?.id ?? "");
  }, [open, orgs]);

  async function generate() {
    if (!text.trim() || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string; extractedRules: unknown[] }>(
        "/api/ai/generate-service",
        { method: "POST", json: { text: text.trim(), orgId } }
      );
      toast.success(
        `Черновик собран${
          res.extractedRules?.length
            ? ` · извлечено правил: ${res.extractedRules.length}`
            : ""
        } — доведите и опубликуйте`
      );
      router.push(`/admin/services/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сгенерировать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent width={640}>
        <DialogHeader>
          <DialogTitle>Сгенерировать услугу из текста</DialogTitle>
          <DialogDescription>
            Вставьте текст программы или правил (например, с adilet.zan.kz). AI
            соберёт черновик — карточку и форму заявки, — который откроется в
            конструкторе для доводки. Публикует человек.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="g-org">Организация</Label>
            <Select
              value={orgId}
              onValueChange={setOrgId}
              placeholder="Выберите организацию"
              ariaLabel="Организация"
              allowClear={false}
              className="mt-1 w-full"
              options={orgs.map((o) => ({ value: o.id, label: `${o.shortName} — ${o.name}` }))}
            />
          </div>
          <div>
            <Label htmlFor="g-text">Текст программы / правил</Label>
            <Textarea
              id="g-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              className="mt-1 font-mono text-[13px]"
              placeholder="Субсидирование части ставки вознаграждения по кредитам субъектов МСБ. Итоговая ставка для заёмщика — 7%. Максимальная сумма кредита — 7 млрд тенге, срок субсидирования — до 60 месяцев…"
            />
          </div>

          {error && (
            <p className="rounded-control border border-st-amber-bg bg-st-amber-bg px-3 py-2 text-[13px] text-st-amber">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted">
            {busy ? "Анализируем текст… извлекаем условия… собираем форму…" : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={generate} disabled={busy || !text.trim()}>
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
                  Генерируем…
                </>
              ) : (
                <>
                  <Sparkles size={18} strokeWidth={1.75} />
                  Сгенерировать
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
