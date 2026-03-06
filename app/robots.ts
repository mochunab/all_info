import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/landing", "/terms", "/topics", "/tags", "/sources"],
      disallow: ["/api/", "/my-feed", "/sources/add", "/login", "/signup", "/auth/"],
    },
    sitemap: "https://aca-info.com/sitemap.xml",
  };
}
