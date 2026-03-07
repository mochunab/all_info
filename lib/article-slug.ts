export function generateArticleSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  const idPrefix = id.substring(0, 4);

  return slug ? `${slug}-${idPrefix}` : idPrefix;
}
