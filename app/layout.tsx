import Script from "next/script";
import localFont from "next/font/local";
import { Outfit } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import GTagPageView from "@/components/GTagPageView";
import { GA_ID } from "@/lib/gtag";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "100 900",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const locale = headerList.get("x-locale") || "ko";

  return (
    <html lang={locale} className={`${pretendard.variable} ${outfit.variable}`}>
      <head>
        <link rel="alternate" type="application/rss+xml" title="아카인포 RSS" href="/feed.xml" />
      </head>
      <body className="antialiased min-h-screen">
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
        {children}
      </body>
    </html>
  );
}
