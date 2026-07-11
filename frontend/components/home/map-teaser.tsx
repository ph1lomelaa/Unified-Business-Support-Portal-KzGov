"use client";

import dynamic from "next/dynamic";

export const MapTeaser = dynamic(
  () => import("./map-teaser-client").then((m) => m.MapTeaserClient),
  {
    ssr: false,
    loading: () => <div className="skeleton h-[420px] rounded-card" />,
  }
);
