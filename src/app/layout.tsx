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
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
