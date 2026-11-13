import { localPath } from "./config";
import type { Locale } from "./content";

export const SECTION_IDS = ["about", "projects", "achievements", "contact"] as const;

export type SceneState = {
  locale: Locale;
  selected: number[];
  section: number;
  progress: number;
  focus: boolean;
};

export function sectionForHash(hash: string) {
  const id = hash.replace(/^#/, "");
  if (["top", "main", "learning"].includes(id)) return 0;
  return SECTION_IDS.findIndex((section) => section === id);
}

export function readSceneState(url: URL): SceneState {
  const section = Math.max(0, sectionForHash(url.hash));
  const selection = url.searchParams.get("s") ?? "";
  const position = url.searchParams.get("p") ?? "";
  const progress = /^\d(?:\.\d{1,6})?$/.test(position) && Number(position) <= 4
    ? Number(position) : section;
  return {
    locale: url.pathname.replace(/\/$/, "") === localPath("/en") ? "en" : "ru",
    selected: /^[0-2]{4}$/.test(selection) ? [...selection].map(Number) : [0, 0, 0, 0],
    section,
    progress,
    focus: url.searchParams.get("focus") === "1" || url.hash === "#learning",
  };
}

export function sceneUrl(current: URL, state: SceneState) {
  const url = new URL(current);
  url.pathname = localPath(state.locale === "en" ? "/en/" : "/");
  url.hash = SECTION_IDS[state.section];
  const selection = state.selected.join("");
  if (selection === "0000") url.searchParams.delete("s");
  else url.searchParams.set("s", selection);
  const progress = Math.round(state.progress * 10000) / 10000;
  if (progress === state.section) url.searchParams.delete("p");
  else url.searchParams.set("p", String(progress));
  if (state.focus) url.searchParams.set("focus", "1");
  else url.searchParams.delete("focus");
  return `${url.pathname}${url.search}${url.hash}`;
}
