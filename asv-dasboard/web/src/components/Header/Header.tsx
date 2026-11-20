/**
 * Header.tsx
 * Header sticky tinggi 64px mengikuti docs/wireframe/dashboard.html
 */

import Link from 'next/link';
import ConnectionBadge from '../ConnectionBadge/ConnectionBadge';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export default function Header() {
  return (
    <header>
      <div className="brand">
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <b>Barunastra ITS</b>
          <i aria-hidden="true" />
          <span>Heracles ASV</span>
        </Link>
        <nav style={{ marginLeft: '24px', display: 'flex', gap: '16px', fontSize: '15px' }}>
          <Link href="/" className="header-nav-link" style={{ color: '#fff', textDecoration: 'none', opacity: 0.9 }}>
            Live
          </Link>
          <Link href="/runs" className="header-nav-link" style={{ color: '#fff', textDecoration: 'none', opacity: 0.9 }}>
            Riwayat Run
          </Link>
        </nav>
      </div>
      <div className="right">
        <ThemeToggle />
        <ConnectionBadge />
      </div>
    </header>
  );
}
