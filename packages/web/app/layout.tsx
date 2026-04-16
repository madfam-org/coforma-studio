import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Coforma Studio - Advisory-as-a-Service Platform',
  description: 'Create, manage, and scale Customer Advisory Boards. By Innovaciones MADFAM.',
  metadataBase: new URL('https://coforma.studio'),
  openGraph: {
    title: 'Coforma Studio - Advisory-as-a-Service Platform',
    description: 'Transform your customer advisory boards into systematic growth engines.',
    url: 'https://coforma.studio',
    siteName: 'Coforma by MADFAM',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coforma Studio - Advisory-as-a-Service',
    description: 'Transform your customer advisory boards into systematic growth engines.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
