import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/terms", "/topics", "/tags", "/sources", "/authors", "/articles", "/blog"],
        disallow: ["/api/", "/my-feed", "/sources/add", "/login", "/signup", "/auth/"],
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"],
        disallow: ["/"],
      },
    ],
    sitemap: "https://aca-info.com/sitemap.xml",
  };
}
