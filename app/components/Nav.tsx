'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Analyze' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/analytics', label: 'Analytics' },
];

/** Global header nav with active-route highlighting. */
export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => {
        // '/' must match exactly; others match their subtree. Product detail
        // pages (/products/[id]) are reached from the watchlist, so they
        // highlight "Watchlist" too.
        const active =
          href === '/'
            ? pathname === '/'
            : pathname.startsWith(href) ||
              (href === '/watchlist' && pathname.startsWith('/products/'));
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
