import { cn } from "@/lib/utils";

export function OrnamentPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox="0 0 240 240"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="eppb-ornament" width="80" height="80" patternUnits="userSpaceOnUse">
          <path
            d="M40 4 76 40 40 76 4 40 40 4Zm0 16 20 20-20 20-20-20 20-20Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M0 40h18m44 0h18M40 0v18m0 44v18M12 12l14 14m28 28 14 14M68 12 54 26M26 54 12 68"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="square"
          />
          <path
            d="M40 28h12v12H40V28Zm-12 12h12v12H28V40Z"
            fill="currentColor"
            opacity=".35"
          />
        </pattern>
      </defs>
      <rect width="240" height="240" fill="url(#eppb-ornament)" />
    </svg>
  );
}

