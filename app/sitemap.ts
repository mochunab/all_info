import type { MetadataRoute } from "next";
import { getCategories, getPopularTags, getActiveSources, getActiveAuthors, getArticleSlugs } from "@/lib/seo-queries";
import { getBlogSlugs } from "@/lib/blog";

const SUPPORTED_LOCALES = ['ko', 'en', 'vi', 'zh', 'ja'] as const;

function buildSitemapAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = `https://aca-info.com${path}?lang=${locale}`;
  }
  return { languages };
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

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://aca-info.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      alternates: buildSitemapAlternates("/"),
    },
    {
      url: "https://aca-info.com/landing",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
      alternates: buildSitemapAlternates("/landing"),
    },
    {
      url: "https://aca-info.com/topics",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: buildSitemapAlternates("/topics"),
    },
    {
      url: "https://aca-info.com/tags",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: buildSitemapAlternates("/tags"),
    },
    {
      url: "https://aca-info.com/sources",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: buildSitemapAlternates("/sources"),
    },
    {
      url: "https://aca-info.com/blog",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: buildSitemapAlternates("/blog"),
    },
    {
      url: "https://aca-info.com/authors",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: buildSitemapAlternates("/authors"),
    },
    {
      url: "https://aca-info.com/terms",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: buildSitemapAlternates("/terms"),
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `https://aca-info.com/topics/${encodeURIComponent(c.name)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
    alternates: buildSitemapAlternates(`/topics/${encodeURIComponent(c.name)}`),
  }));

  const tagPages: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `https://aca-info.com/tags/${encodeURIComponent(t.tag)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
    alternates: buildSitemapAlternates(`/tags/${encodeURIComponent(t.tag)}`),
  }));

  const sourcePages: MetadataRoute.Sitemap = sources.map((s) => ({
    url: `https://aca-info.com/sources/${encodeURIComponent(s.name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
    alternates: buildSitemapAlternates(`/sources/${encodeURIComponent(s.name)}`),
  }));

  const authorPages: MetadataRoute.Sitemap = authors.map((a) => ({
    url: `https://aca-info.com/authors/${encodeURIComponent(a.name)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
    alternates: buildSitemapAlternates(`/authors/${encodeURIComponent(a.name)}`),
  }));

  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((s) => ({
    url: `https://aca-info.com/blog/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
    alternates: buildSitemapAlternates(`/blog/${s.slug}`),
  }));

  const articlePages: MetadataRoute.Sitemap = articleSlugs.map((s) => ({
    url: `https://aca-info.com/articles/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
    alternates: buildSitemapAlternates(`/articles/${s.slug}`),
  }));

  return [...staticPages, ...categoryPages, ...tagPages, ...sourcePages, ...authorPages, ...blogPages, ...articlePages];
}
