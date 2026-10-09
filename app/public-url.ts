/** Prefix a public-folder path with the Vite base. Root deploy uses `/`. */
export function publicUrl(path: string) {
  const base = import.meta.env.BASE_URL || '/';
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${clean}`;
}
