import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LOCALES, OG_LOCALES } from "@/lib/locale-config";
import type { Locale } from "@/lib/locale-config";
import { buildAlternateLanguages } from "@/lib/hreflang";
import Providers from "@/app/providers";

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

function isValidLocale(locale: string): locale is Locale {
  return (LOCALES as readonly string[]).includes(locale);
}

const META: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  ko: {
    title: "아카인포 - 나만의 면접 치트키",
    description: "면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!",
    keywords: ["AI 면접 코칭", "업계 브리핑", "비즈니스 인사이트", "마케팅 트렌드", "스타트업", "아카인포"],
  },
  en: {
    title: "ACA Info - Your Interview Cheat Sheet",
    description: "Stay ahead in interviews with AI-powered industry briefings and coaching.",
    keywords: ["AI interview coaching", "industry briefing", "business insights", "marketing trends", "startup"],
  },
  vi: {
    title: "ACA Info - Bí quyết phỏng vấn của bạn",
    description: "Chuẩn bị phỏng vấn hiệu quả với AI tóm tắt tin tức ngành.",
    keywords: ["AI phỏng vấn", "tin tức ngành", "xu hướng kinh doanh"],
  },
  zh: {
    title: "ACA Info - 你的面试秘籍",
    description: "AI驱动的行业简报，助你面试脱颖而出。",
    keywords: ["AI面试辅导", "行业简报", "商业洞察", "营销趋势", "创业"],
  },
  ja: {
    title: "ACA Info - 面接対策チートシート",
    description: "AI業界ブリーフィングで面接準備を万全に。",
    keywords: ["AI面接対策", "業界ブリーフィング", "ビジネスインサイト", "マーケティングトレンド"],
  },
};

const ORG_NAME: Record<Locale, string> = {
  ko: "아카인포",
  en: "ACA Info",
  vi: "ACA Info",
  zh: "ACA Info",
  ja: "ACA Info",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const m = META[locale];
  const ogLocale = OG_LOCALES[locale];

  return {
    metadataBase: new URL("https://aca-info.com"),
    title: { default: m.title, template: `%s | ${ORG_NAME[locale]}` },
    description: m.description,
    keywords: m.keywords,
    authors: [{ name: ORG_NAME[locale] }],
    creator: ORG_NAME[locale],
    openGraph: {
      title: m.title,
      description: m.description,
      type: "website",
      locale: ogLocale,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: m.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: m.title }],
    },
    alternates: {
      canonical: `/${locale}`,
      languages: buildAlternateLanguages(""),
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const orgName = ORG_NAME[locale];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: orgName,
                url: "https://aca-info.com",
                logo: "https://aca-info.com/logo.png",
              },
              {
                "@type": "WebSite",
                name: orgName,
                url: "https://aca-info.com",
                description: META[locale].description,
              },
            ],
          }),
        }}
      />
      <Providers locale={locale}>{children}</Providers>
    </>
  );
}
