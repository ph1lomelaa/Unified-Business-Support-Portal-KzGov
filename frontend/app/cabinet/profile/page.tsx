"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Company } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { OrgMonogram } from "@/components/org-monogram";

const CATEGORY: Record<string, string> = {
  micro: "Микробизнес",
  small: "Малый бизнес",
  medium: "Средний бизнес",
  large: "Крупный бизнес",
};

type ProfilePayload = {
  company: Company;
  contacts: {
    email: string;
    phone: string;
    notifyEmail: boolean;
    updatedAt: string | null;
  };
};

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<ProfilePayload | null>(null);
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notifyEmail, setNotifyEmail] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api<ProfilePayload>("/api/v1/profile")
      .then((payload) => {
        setProfile(payload);
        setEmail(payload.contacts.email);
        setPhone(payload.contacts.phone);
        setNotifyEmail(payload.contacts.notifyEmail);
      })
      .catch(() => setProfile(null));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const payload = await api<ProfilePayload>("/api/v1/profile", {
        method: "PATCH",
        json: { email, phone, notifyEmail },
      });
      setProfile(payload);
      setEmail(payload.contacts.email);
      setPhone(payload.contacts.phone);
      setNotifyEmail(payload.contacts.notifyEmail);
      toast.success("Профиль сохранён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

  const company = profile?.company;

  return (
    <div>
      <h1 className="text-[24px] font-semibold text-ink">Профиль компании</h1>
      <p className="mt-1 text-[14px] text-muted">
        Регистрационные данные поступают из госреестра, контакты сохраняются в ЕППБ.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardBody>
            {profile === null ? (
              <div className="space-y-3">
                <div className="skeleton h-11 w-2/3" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <OrgMonogram name={company?.name ?? "?"} size={44} />
                  <div>
                    <p className="text-[16px] font-semibold text-ink">
                      {company?.name ?? "—"}
                    </p>
                    <p className="num text-[13px] text-muted">
                      БИН {company?.bin ?? "—"}
                    </p>
                  </div>
                </div>
                <dl className="divide-y divide-border">
                  <Row label="Форма" value={company?.form} />
                  <Row
                    label="ОКЭД"
                    value={company ? `${company.oked} — ${company.okedName}` : undefined}
                  />
                  <Row label="Руководитель" value={company?.director} />
                  <Row label="Регион" value={company?.region} />
                  <Row label="Адрес" value={company?.address} />
                  <Row
                    label="Категория"
                    value={company ? CATEGORY[company.category] ?? company.category : undefined}
                  />
                </dl>
                <p className="mt-3 text-[12px] text-muted">
                  Источник: {company?.source ?? "ГБД ЮЛ (имитация)"}
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <p className="text-[14px] font-semibold text-ink">Контакты для уведомлений</p>
              <p className="mt-1 text-[12px] text-muted">
                Эти данные используются порталом для писем и обратной связи по заявкам.
              </p>
            </div>
            <div>
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1"
                placeholder="info@company.kz"
              />
            </div>
            <div>
              <Label htmlFor="p-phone">Телефон</Label>
              <Input
                id="p-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1"
                placeholder="+7 700 000 00 00"
              />
            </div>
            <label className="flex items-center gap-2.5 pt-2 text-[13px] text-fg">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.checked)}
              />
              Присылать уведомления на email
            </label>
            <Button onClick={save} disabled={saving || !email || !phone}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
              ) : (
                <Save size={16} strokeWidth={1.75} />
              )}
              Сохранить изменения
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-right text-[14px] font-medium text-fg">
        {value ?? "—"}
      </dd>
    </div>
  );
}
