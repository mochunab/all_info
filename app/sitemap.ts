import type { MetadataRoute } from "next";
import { getCategories, getPopularTags, getActiveSources } from "@/lib/seo-queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, tags, sources] = await Promise.all([
    getCategories(),
    getPopularTags(50),
    getActiveSources(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://aca-info.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: "https://aca-info.com/landing",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://aca-info.com/topics",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://aca-info.com/tags",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://aca-info.com/sources",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://aca-info.com/terms",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `https://aca-info.com/topics/${encodeURIComponent(c.name)}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const tagPages: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `https://aca-info.com/tags/${encodeURIComponent(t.tag)}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const sourcePages: MetadataRoute.Sitemap = sources.map((s) => ({
    url: `https://aca-info.com/sources/${encodeURIComponent(s.name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...tagPages, ...sourcePages];
}
