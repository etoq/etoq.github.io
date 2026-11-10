export const config = {
  name: "eto",
  siteUrl: "https://etoq.github.io",
  repositoryUrl: "https://github.com/etoq/etoq.github.io",
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, ""),
  colors: {
    background: "#030708",
    panel: "#0c171a",
    text: "#e8f3ef",
    muted: "#9eb5b0",
    tiffany: "#0abab5",
    light: "#9cf5e6",
  },
  motion: {
    duration: 4.8,
  },
} as const;

export function localPath(path: string) {
  return `${config.basePath}${path}`;
}

export function absoluteUrl(path: string) {
  return `${config.siteUrl}${localPath(path)}`;
}
