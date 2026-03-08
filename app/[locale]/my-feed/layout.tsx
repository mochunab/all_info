import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '마이피드',
};

export default function MyFeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
