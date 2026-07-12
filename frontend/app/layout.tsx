import type { Metadata } from "next";
import { Golos_Text } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n/provider";
import { NavigationTracker } from "@/components/ui/back-link";
import type { Locale } from "@/i18n/dictionaries";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const golosText = Golos_Text({
  subsets: ["cyrillic", "cyrillic-ext", "latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-golos",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ЕППБ — Единый портал поддержки бизнеса",
    template: "%s · ЕППБ",
  },
  description:
    "Вся государственная поддержка бизнеса Холдинга «Байтерек» в одном окне.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale: Locale =
    cookieStore.get("locale")?.value === "kk" ? "kk" : "ru";

  return (
    <html lang={locale} className={`h-full ${golosText.variable}`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider initialLocale={locale}>
          <NavigationTracker />
          {children}
        </I18nProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "14px",
              border: "1px solid var(--color-border)",
              fontFamily: "var(--font-golos)",
            },
          }}
        />
      </body>
    </html>
  );
}
