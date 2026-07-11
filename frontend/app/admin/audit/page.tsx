"use client";

import { AuditLogTable } from "@/components/admin/audit-log-table";

export default function AdminAuditPage() {
  return (
    <div>
      <div>
        <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">
          Governance log
        </p>
        <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">
          Аудит изменений
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-muted">
          Журнал фиксирует публикации услуг, версии форм, шаблоны документов,
          смену статусов заявок, AI-генерации и публикации импортов.
        </p>
      </div>
      <div className="mt-6">
        <AuditLogTable />
      </div>
    </div>
  );
}
