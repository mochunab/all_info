import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import GTagPageView from "@/components/GTagPageView";
import { GA_ID } from "@/lib/gtag";

export const metadata: Metadata = {
  metadataBase: new URL("https://aca-info.com"),
  title: {
    default: "아카인포 - 나만의 면접 치트키",
    template: "%s | 아카인포",
  },
  description: "면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!",
  keywords: [
    "AI 면접 코칭",
    "업계 브리핑",
    "비즈니스 인사이트",
    "마케팅 트렌드",
    "스타트업",
    "아카인포",
  ],
  authors: [{ name: "아카인포" }],
  creator: "아카인포",
  openGraph: {
    title: "아카인포 - 나만의 면접 치트키",
    description: "면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "아카인포 - 나만의 면접 치트키" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "아카인포 - 나만의 면접 치트키",
    description: "면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "아카인포 - 나만의 면접 치트키" }],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard Font */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        {/* Outfit Font for Logo */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "아카인포",
                  url: "https://aca-info.com",
                  logo: "https://aca-info.com/logo.png",
                },
                {
                  "@type": "WebSite",
                  name: "아카인포",
                  url: "https://aca-info.com",
                  description:
                    "면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!",
                },
              ],
            }),
          }}
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        <Suspense fallback={null}>
          <GTagPageView />
        </Suspense>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
