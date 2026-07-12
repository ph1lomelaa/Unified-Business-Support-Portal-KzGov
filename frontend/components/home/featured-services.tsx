"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { ServiceCard as ServiceCardType } from "@/lib/types";
import { ServiceCard } from "@/components/catalog/service-card";

// Витрина «Популярные услуги»: 3 курируемые услуги на главной. Берём реальные
// карточки из каталога по слагам (порядок сохраняем), переиспользуя ServiceCard.
const FEATURED = ["brk-wagons-leasing", "damu-subsidy", "akk-animal"];

export function FeaturedServices() {
  const [services, setServices] = React.useState<ServiceCardType[] | null>(null);

  React.useEffect(() => {
    api<ServiceCardType[]>("/api/v1/services")
      .then((rows) => {
        const bySlug = new Map(rows.map((s) => [s.slug, s]));
        setServices(
          FEATURED.map((slug) => bySlug.get(slug)).filter(Boolean) as ServiceCardType[]
        );
      })
      .catch(() => setServices([]));
  }, []);

  if (services === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="skeleton h-10 w-10 rounded-control" />
            <div className="skeleton mt-4 h-4 w-2/3" />
            <div className="skeleton mt-3 h-3 w-full" />
            <div className="skeleton mt-2 h-3 w-5/6" />
            <div className="skeleton mt-5 h-8 w-28 rounded-control" />
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  );
}
