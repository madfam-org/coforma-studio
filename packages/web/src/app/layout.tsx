import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from '../components/providers/trpc-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Coforma Studio - Advisory-as-a-Service',
  description: 'Transform your customer advisory boards into systematic growth engines. By Innovaciones MADFAM.',
  metadataBase: new URL('https://coforma.studio'),
  openGraph: {
    title: 'Coforma Studio - Advisory-as-a-Service',
    description: 'Transform your customer advisory boards into systematic growth engines.',
    url: 'https://coforma.studio',
    siteName: 'Coforma by MADFAM',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
