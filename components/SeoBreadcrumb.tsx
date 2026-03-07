import Link from 'next/link';
import { localePath } from '@/lib/locale-path';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type SeoBreadcrumbProps = {
  items: BreadcrumbItem[];
  locale?: string;
};

export default function SeoBreadcrumb({ items, locale = 'ko' }: SeoBreadcrumbProps) {
  const lp = (path: string) => localePath(locale, path);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: `https://aca-info.com/${locale}` },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.label,
        ...(item.href ? { item: `https://aca-info.com${lp(item.href)}` } : {}),
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--text-tertiary)] mb-6">
        <ol className="flex items-center gap-1.5 flex-wrap">
          <li>
            <Link href={lp('/')} className="hover:text-[var(--accent)] transition-colors">홈</Link>
          </li>
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span>/</span>
              {item.href ? (
                <Link href={lp(item.href)} className="hover:text-[var(--accent)] transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-[var(--text-primary)]">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
