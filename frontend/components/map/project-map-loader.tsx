"use client";

import dynamic from "next/dynamic";

export const ProjectMapLoader = dynamic(
  () => import("./project-map").then((m) => m.ProjectMap),
  {
    ssr: false,
    loading: () => <div className="skeleton h-[640px] rounded-card" />,
  }
);
