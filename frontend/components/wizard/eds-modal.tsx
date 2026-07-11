"use client";

import * as React from "react";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signCmsBase64, NCALAYER_NOT_FOUND } from "@/lib/ncalayer";

// EDS signing ceremony (spec 4.4). Tries NCALayer first; if it's not running,
// falls back to a demo certificate + password step that mimics bgov.kz.
const DEMO_CERTS = [
  "AUTH RSA — Нурланов Асхат (ИИН 901010300123)",
  "GOST TUMAR — ТОО «AgroDala» (БИН 123456789012)",
];

type Phase = "connecting" | "demo" | "signing";

export function EdsModal({
  open,
  onOpenChange,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSigned: () => Promise<void>;
}) {
  const [phase, setPhase] = React.useState<Phase>("connecting");
  const [cert, setCert] = React.useState(0);
  const [note, setNote] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    setPhase("signing");
    await onSigned();
  }, [onSigned]);

  React.useEffect(() => {
    if (!open) return;
    setPhase("connecting");
    setNote(null);
    let cancelled = false;
    (async () => {
      try {
        const { nonce } = await fetch("/bff/api/auth/nonce").then((r) => r.json());
        await signCmsBase64(nonce);
        if (!cancelled) await run();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        setNote(
          msg === NCALAYER_NOT_FOUND
            ? "NCALayer не найден — используйте демо-подпись."
            : "Подпись через NCALayer не выполнена — используйте демо-подпись."
        );
        setPhase("demo");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, run]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width={460}>
        <DialogHeader>
          <DialogTitle>Подписание ЭЦП</DialogTitle>
          <DialogDescription>
            Подпишите заявление электронной цифровой подписью.
          </DialogDescription>
        </DialogHeader>

        {phase === "connecting" && (
          <div className="flex items-center gap-3 rounded-control border border-border bg-bg px-4 py-4 text-[14px] text-fg">
            <Loader2 size={20} className="animate-spin text-ink" strokeWidth={1.75} />
            Подключаемся к NCALayer…
          </div>
        )}

        {phase === "signing" && (
          <div className="flex items-center gap-3 rounded-control border border-border bg-bg px-4 py-4 text-[14px] text-fg">
            <Loader2 size={20} className="animate-spin text-ink" strokeWidth={1.75} />
            Подписание и отправка…
          </div>
        )}

        {phase === "demo" && (
          <div className="space-y-4">
            {note && (
              <p className="rounded-control border border-st-amber-bg bg-st-amber-bg px-3 py-2 text-[13px] text-st-amber">
                {note}
              </p>
            )}
            <div>
              <Label>Сертификат</Label>
              <div className="mt-1 space-y-1.5">
                {DEMO_CERTS.map((c, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-center gap-2 rounded-control border border-border px-3 py-2 text-[13px] hover:border-ink"
                  >
                    <input
                      type="radio"
                      name="cert"
                      checked={cert === i}
                      onChange={() => setCert(i)}
                    />
                    <ShieldCheck size={16} strokeWidth={1.75} className="text-accent" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="eds-pw">Пароль хранилища</Label>
              <div className="relative mt-1">
                <KeyRound
                  size={16}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  id="eds-pw"
                  type="password"
                  defaultValue="demo"
                  className="pl-9"
                />
              </div>
            </div>
            <Button onClick={run} className="w-full" size="lg">
              <ShieldCheck size={20} strokeWidth={1.75} />
              Подписать и отправить
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
