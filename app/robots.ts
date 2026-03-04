import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/landing", "/terms"],
      disallow: ["/api/", "/my-feed", "/sources/", "/login", "/signup", "/auth/"],
    },
    sitemap: "https://aca-info.com/sitemap.xml",
  };
}
