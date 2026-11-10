import localFont from "next/font/local";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/content";
import "@/app/globals.css";

const geologica = localFont({
  src: "../../public/fonts/geologica.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

const mono = localFont({
  src: [
    { path: "../../public/fonts/ibm-plex-mono-regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/ibm-plex-mono-medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["monospace"],
});

export default function SiteDocument({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <html lang={locale} className={`${geologica.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
