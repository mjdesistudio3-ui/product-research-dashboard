import type { Metadata } from 'next';
import './globals.css';
import Nav from './components/Nav';
import { ToastProvider } from './components/Toast';

export const metadata: Metadata = {
  title: 'ResearchDash — Product Research Dashboard',
  description:
    'Research Etsy & Amazon products, save them to a tagged watchlist, and spot pricing patterns.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <ToastProvider>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <a href="/" className="text-lg font-bold tracking-tight">
                Research<span className="text-indigo-600">Dash</span>
              </a>
              <Nav />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400">
            ResearchDash · reads public summary data only · sales figures are rough
            estimates, not verified data
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
