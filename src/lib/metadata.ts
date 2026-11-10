import type { Metadata } from "next";
import { content, type Locale } from "./content";
import { absoluteUrl, localPath } from "./config";

export function pageMetadata(locale: Locale): Metadata {
  const copy = content[locale].metadata;
  const path = locale === "ru" ? "/" : "/en/";
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: absoluteUrl(path),
      languages: { ru: absoluteUrl("/"), en: absoluteUrl("/en/"), "x-default": absoluteUrl("/") },
    },
    icons: { icon: { url: localPath("/favicon.svg"), type: "image/svg+xml" } },
    openGraph: {
      type: "website",
      title: copy.title,
      description: copy.description,
      url: absoluteUrl(path),
      siteName: "eto",
      locale: locale === "ru" ? "ru_RU" : "en_US",
      alternateLocale: locale === "ru" ? "en_US" : "ru_RU",
      images: [{ url: absoluteUrl("/og.png"), width: 1200, height: 630, alt: "eto — Malware analysis" }],
    },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: [absoluteUrl("/og.png")] },
  };
}
