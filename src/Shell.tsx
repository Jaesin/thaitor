import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useMode } from './themes/ModeContext';
import Home from './screens/Home';
import Translate from './screens/Translate';
import Exercise from './screens/Exercise';
import TonePop from './screens/TonePop';
import ToneTrace from './screens/ToneTrace';
import SessionStart from './screens/SessionStart';
import SessionSummary from './screens/SessionSummary';
import Deck from './screens/Deck';
import Join from './screens/Join';
import Settings from './screens/Settings';
import { buildSession, type SessionMakeup, type SessionResult } from './data/srs';
import styles from './Shell.module.css';

type PlayPhase = 'start' | 'build' | 'tonepop' | 'summary';

const PlayHub: React.FC = () => {
  const [phase, setPhase] = useState<PlayPhase>('start');
  const [makeup, setMakeup] = useState<SessionMakeup | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (phase !== 'start') return;
    setMakeup(null);
    (async () => {
      const next = await buildSession();
      if (!cancelled) setMakeup(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  if (phase === 'summary' && result) {
    return (
      <SessionSummary
        result={result}
        onDone={() => {
          setResult(null);
          setPhase('start');
        }}
      />
    );
  }

  if (phase === 'build') {
    return (
      <Exercise
        onDone={(r) => {
          setResult(r);
          setPhase('summary');
        }}
      />
    );
  }

  if (phase === 'tonepop') {
    return (
      <TonePop
        onDone={(r) => {
          setResult(r);
          setPhase('summary');
        }}
      />
    );
  }

  if (!makeup) {
    return (
      <div className={styles.playLoading} role="status">
        Preparing your session…
      </div>
    );
  }

  return (
    <SessionStart
      makeup={makeup}
      onStart={(mode) => setPhase(mode === 'build' ? 'build' : 'tonepop')}
    />
  );
};

type TabId = 'today' | 'translate' | 'play' | 'deck' | 'settings';

const NavIcon: React.FC<{ name: TabId }> = ({ name }) => {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'today')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (name === 'translate')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
        <path d="M4 5h7M7.5 5c0 4-2 7-4.5 9M5 9c1.5 2.5 4 4 6 4.5" />
        <path d="M13 19l3.5-8 3.5 8M14.3 16h4.4" />
      </svg>
    );
  if (name === 'play')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
        <rect x="3" y="7" width="18" height="11" rx="4" />
        <path d="M7.5 12h3M9 10.5v3" />
        <circle cx="16" cy="11.5" r="0.6" fill="currentColor" />
        <circle cx="18" cy="14" r="0.6" fill="currentColor" />
      </svg>
    );
  if (name === 'deck')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
        <path d="M5 4h10a2 2 0 0 1 2 2v14l-7-3-7 3V6a2 2 0 0 1 2-2z" />
        <path d="M9.5 9.5l1.2 1.2 2.3-2.3" />
      </svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
};

const TABS: { id: TabId; label: string; href: string; path: string }[] = [
  { id: 'today', label: 'Today', href: '#/', path: '/' },
  { id: 'translate', label: 'Translate', href: '#/translate', path: '/translate' },
  { id: 'play', label: 'Play', href: '#/play', path: '/play' },
  { id: 'deck', label: 'Deck', href: '#/deck', path: '/deck' },
  { id: 'settings', label: 'Settings', href: '#/settings', path: '/settings' },
];

const BottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const { mode } = useMode();
  const tabs = TABS.filter((tab) => {
    if (tab.id === 'translate') return mode === 'travel';
    if (tab.id === 'play') return mode === 'learn';
    return true;
  });
  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <a
            key={tab.id}
            href={tab.href}
            className={`${styles.item} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <NavIcon name={tab.id} />
            <span className={styles.label}>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );
};

const Shell: React.FC = () => {
  return (
    <HashRouter>
      <div className={styles.shell}>
        <main className={styles.content}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/translate" element={<Translate />} />
            <Route path="/play" element={<PlayHub />} />
            <Route path="/deck" element={<Deck />} />
            <Route path="/trace" element={<ToneTrace />} />
            <Route path="/join" element={<Join />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  );
};

export default Shell;
