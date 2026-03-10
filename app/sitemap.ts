import type { MetadataRoute } from "next";
import { getCategories, getPopularTags, getActiveSources, getActiveAuthors, getArticleSlugs } from "@/lib/seo-queries";
import { getBlogSlugs } from "@/lib/blog";
import { LOCALES } from "@/lib/locale-config";

function buildSitemapAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = `https://aca-info.com/${locale}${path}`;
  }
  return { languages };
}

function localeEntries(
  path: string,
  opts: { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number },
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: `https://aca-info.com/${locale}${path}`,
    lastModified: new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: buildSitemapAlternates(path),
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, tags, sources, authors, blogSlugs, articleSlugs] = await Promise.all([
    getCategories(),
    getPopularTags(50),
    getActiveSources(),
    getActiveAuthors(100),
    getBlogSlugs(),
    getArticleSlugs(),
  ]);

  const staticPages = [
    ...localeEntries("", { changeFrequency: "daily", priority: 1.0 }),
    ...localeEntries("/landing", { changeFrequency: "monthly", priority: 0.9 }),
    ...localeEntries("/topics", { changeFrequency: "weekly", priority: 0.8 }),
    ...localeEntries("/tags", { changeFrequency: "weekly", priority: 0.7 }),
    ...localeEntries("/sources", { changeFrequency: "weekly", priority: 0.7 }),
    ...localeEntries("/blog", { changeFrequency: "weekly", priority: 0.8 }),
    ...localeEntries("/authors", { changeFrequency: "weekly", priority: 0.7 }),
    ...localeEntries("/terms", { changeFrequency: "yearly", priority: 0.3 }),
  ];

  const dynamicPages = [
    ...categories.flatMap((c) =>
      localeEntries(`/topics/${encodeURIComponent(c.name)}`, { changeFrequency: "daily", priority: 0.7 }),
    ),
    ...tags.flatMap((t) =>
      localeEntries(`/tags/${encodeURIComponent(t.tag)}`, { changeFrequency: "daily", priority: 0.6 }),
    ),
    ...sources.flatMap((s) =>
      localeEntries(`/sources/${encodeURIComponent(s.name)}`, { changeFrequency: "weekly", priority: 0.6 }),
    ),
    ...authors.flatMap((a) =>
      localeEntries(`/authors/${encodeURIComponent(a.name)}`, { changeFrequency: "daily", priority: 0.6 }),
    ),
    ...blogSlugs.map((s) => ({
      url: `https://aca-info.com/${s.language}/blog/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...articleSlugs.flatMap((s) =>
      localeEntries(`/articles/${s.slug}`, { changeFrequency: "daily", priority: 0.6 }),
    ),
  ];

  return [...staticPages, ...dynamicPages];
}
