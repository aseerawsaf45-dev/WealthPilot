import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WealthPilot — Personal Wealth Workspace & Precision Ledger',
  description: 'Production-grade personal finance assistant engineered with mathematical precision, deterministic ledger reconciliation, and zero-knowledge privacy.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/PlusJakartaSans.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/JetBrainsMono.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F4F6F9] text-[#0F172A]">
        {children}
      </body>
    </html>
  );
}
