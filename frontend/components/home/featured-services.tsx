"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { ServiceCard as ServiceCardType } from "@/lib/types";
import { ServiceCard } from "@/components/catalog/service-card";

// Витрина «Популярные услуги»: 3 курируемые услуги на главной. Берём реальные
// карточки из каталога по слагам (порядок сохраняем), переиспользуя ServiceCard.
const FEATURED = ["brk-wagons-leasing", "damu-subsidy", "akk-animal"];

export function FeaturedServices() {
  const [services, setServices] = React.useState<ServiceCardType[]>([]);

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

  if (services.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  );
}
