"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/content";
import type { GraphicsQuality } from "@/lib/elf";
import "./graphics-control.css";

const storageKey = "eto.graphicsQuality";

function savedQuality(value: string | null): GraphicsQuality {
  return value === "lite" ? "lite" : "full";
}

export default function GraphicsControl({ locale, onChange }: {
  locale: Locale;
  onChange: (quality: GraphicsQuality) => void;
}) {
  const [quality, setQuality] = useState<GraphicsQuality>("full");
  const [hydrated, setHydrated] = useState(false);
  const label = locale === "ru" ? "Графика" : "Graphics";
  const value = locale === "ru"
    ? quality === "lite" ? "Лёгкая" : "Полная"
    : quality === "lite" ? "Lite" : "Full";

  useEffect(() => {
    let restored: GraphicsQuality = "full";
    try {
      restored = savedQuality(localStorage.getItem(storageKey));
    } catch {
      // Graphics can still be changed when browser storage is unavailable.
    }
    setQuality(restored);
    onChange(restored);
    setHydrated(true);

    function synchronize(event: StorageEvent) {
      if (event.key !== storageKey && event.key !== null) return;
      const next = savedQuality(event.newValue);
      setQuality(next);
      onChange(next);
    }

    addEventListener("storage", synchronize);
    return () => removeEventListener("storage", synchronize);
  }, [onChange]);

  function toggleQuality() {
    const next = quality === "full" ? "lite" : "full";
    setQuality(next);
    onChange(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Keep the current choice for this page without persistent storage.
    }
  }

  return (
    <button
      className="graphics-control"
      type="button"
      data-ready={hydrated}
      disabled={!hydrated}
      aria-label={locale === "ru" ? "Лёгкая графика" : "Lite graphics"}
      aria-pressed={quality === "lite"}
      onClick={toggleQuality}
    >
      <span className="graphics-control-label">{label}</span>
      <span className="graphics-control-value" aria-hidden="true">{value}</span>
    </button>
  );
}
