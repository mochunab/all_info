import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/api/", "/*/my-feed", "/*/sources/add", "/*/login", "/*/signup", "/auth/"],
      },
      {
        userAgent: "Baiduspider",
        allow: ["/zh/"],
        crawlDelay: 1,
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"],
        disallow: ["/"],
      },
    ],
    sitemap: "https://aca-info.com/sitemap.xml",
  };
}
