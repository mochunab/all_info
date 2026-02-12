import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "아카인포 - 비즈니스 인사이트 아카이브",
  description: "비즈니스 인사이트를 수집하고 보관합니다. 마케팅, 브랜딩, 스타트업, 리테일 트렌드를 AI가 요약해드립니다.",
  keywords: ["비즈니스", "마케팅", "인사이트", "트렌드", "브랜딩", "스타트업", "아카이브"],
  authors: [{ name: "아카인포" }],
  openGraph: {
    title: "아카인포 - 비즈니스 인사이트 아카이브",
    description: "비즈니스 인사이트를 수집하고 보관합니다",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "아카인포 - 비즈니스 인사이트 아카이브",
    description: "비즈니스 인사이트를 수집하고 보관합니다",
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
        {children}
      </body>
    </html>
  );
}
