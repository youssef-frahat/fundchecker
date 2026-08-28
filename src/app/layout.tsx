import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Investment Management Platform | Trade Ingestion & Netting Engine',
  description: 'Enterprise internal investment management, automated trade ingestion, T0/T1 rule processing, netting sheet calculation, and Maker-Checker review system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-emerald-200 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
