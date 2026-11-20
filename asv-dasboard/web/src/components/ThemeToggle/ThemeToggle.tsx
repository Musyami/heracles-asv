'use client';

/**
 * ThemeToggle.tsx
 * Slider alih tema 76px sesuai docs/wireframe/dashboard.html
 */

import { useSyncExternalStore } from 'react';

function subscribeToTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('theme-change', callback);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('theme-change', callback);
    mediaQuery.removeEventListener('change', callback);
  };
}

function getThemeSnapshot(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  const docTheme = document.documentElement.getAttribute('data-theme');
  if (docTheme === 'dark' || docTheme === 'light') {
    return docTheme;
  }

  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Abaikan jika localStorage tidak aktif
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getServerThemeSnapshot(): 'light' | 'dark' {
  return 'light';
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const isDark = theme === 'dark';

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);

    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // Abaikan jika localStorage dibatasi browser
    }

    window.dispatchEvent(new Event('theme-change'));
  };

  return (
    <button
      type="button"
      className="toggle"
      onClick={toggleTheme}
      aria-label={`Ganti ke tema ${isDark ? 'terang' : 'gelap'}`}
      title={`Beralih ke mode ${isDark ? 'terang' : 'gelap'}`}
    >
      <div className="knob" />
      <span className="ic sun" aria-hidden="true">&#9728;</span>
      <span className="ic moon" aria-hidden="true">&#9790;</span>
    </button>
  );
}
