"use client";

import dynamic from "next/dynamic";
import type { ServiceFull } from "@/lib/types";

const ApplyWizard = dynamic(
  () => import("./apply-wizard").then((m) => m.ApplyWizard),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-[420px] w-full" />
      </div>
    ),
  }
);

export function ApplyWizardLoader({
  service,
  userBin,
}: {
  service: ServiceFull;
  userBin?: string | null;
}) {
  return <ApplyWizard service={service} userBin={userBin} />;
}
