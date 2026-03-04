import Link from 'next/link';

export const metadata = {
  title: '이용약관',
  description: '아카인포 서비스 이용약관, 크롤링 Opt-out 안내 및 저작권 고지.',
  robots: { index: true, follow: false },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-8"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          홈으로
        </Link>

        <article className="prose prose-invert max-w-none">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">이용약관</h1>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">1. 서비스 개요</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              아카인포(이하 &ldquo;서비스&rdquo;)는 공개된 웹 콘텐츠를 자동 수집하여 요약·큐레이션하는 비영리 정보 서비스입니다.
              수집된 콘텐츠의 저작권은 원 저작자에게 있으며, 본 서비스는 원본 링크를 항상 제공합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">2. 수집 데이터 범위</h2>
            <ul className="text-sm text-[var(--text-secondary)] leading-relaxed list-disc pl-5 space-y-1">
              <li>공개된 웹페이지의 제목, 본문 일부(500자 미만), 게시일, 저자 정보</li>
              <li>RSS/Atom 피드에 공개된 메타데이터</li>
              <li>AI 기반 요약문(원문이 아닌 가공된 텍스트)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">3. 저작권 안내</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              수집된 모든 콘텐츠의 저작권은 원 저작자 또는 해당 매체에 귀속됩니다.
              본 서비스는 공정 이용(Fair Use) 범위 내에서 제목과 요약만을 표시하며,
              전문(全文)을 복제·배포하지 않습니다. 원문은 항상 원본 링크를 통해 확인할 수 있습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">4. 크롤링 Opt-out</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              본 서비스의 크롤러는 <code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">robots.txt</code>를 준수합니다.
              크롤링 봇의 User-Agent는 <code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">InsightHub/1.0</code>입니다.
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-2">
              크롤링 중단을 원하시면 아래 방법으로 요청해 주세요:
            </p>
            <ul className="text-sm text-[var(--text-secondary)] leading-relaxed list-disc pl-5 space-y-1 mt-2">
              <li><code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">robots.txt</code>에서 <code className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">User-agent: InsightHub</code>를 Disallow 처리</li>
              <li>이메일: <a href="mailto:gksrufk813@daum.net" className="text-[var(--accent)] hover:underline">gksrufk813@daum.net</a></li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">5. 면책 조항</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              본 서비스는 정보 제공 목적으로만 운영되며, 수집된 콘텐츠의 정확성·완전성을 보증하지 않습니다.
              AI 요약은 원문과 다를 수 있으므로, 정확한 내용은 반드시 원본 링크를 통해 확인하시기 바랍니다.
              서비스 이용으로 인한 손해에 대해 책임을 지지 않습니다.
            </p>
          </section>

          <p className="text-xs text-[var(--text-tertiary)] mt-12">
            최종 업데이트: 2026년 3월 1일
          </p>
        </article>
      </div>
    </div>
  );
}
