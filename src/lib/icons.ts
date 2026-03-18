import * as simpleIcons from "simple-icons";

export function getSimpleIconSvg(iconKey: string | undefined, size = 24): string {
  if (!iconKey) return "";

  const icon = (simpleIcons as Record<string, { path: string }>)[iconKey];
  if (!icon?.path) return "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="${icon.path}"/></svg>`;
}
