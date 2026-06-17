import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { useMember } from './auth/useMember';
import Home from './screens/Home';
import Translate from './screens/Translate';
import Exercise from './screens/Exercise';
import AudioPick from './screens/AudioPick';
import TonePop from './screens/TonePop';
import TonePairDojo from './screens/TonePairDojo';
import EchoBooth from './screens/EchoBooth';
import ScriptLadder from './screens/ScriptLadder';
import ToneTrace from './screens/ToneTrace';
import SessionStart from './screens/SessionStart';
import SessionSummary from './screens/SessionSummary';
import Deck from './screens/Deck';
import Join from './screens/Join';
import Settings from './screens/Settings';
import { buildSession, type SessionMakeup, type SessionResult } from './data/srs';
import {
  listProfiles,
  syncKidModeMirror,
  applyActiveProfileVoices,
  getKidMode,
} from './data/profiles';
import styles from './Shell.module.css';

type PlayPhase =
  | 'start'
  | 'listen'
  | 'build'
  | 'tonepop'
  | 'readtone'
  | 'dojo'
  | 'echo'
  | 'script'
  | 'summary';

const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className={styles.offlineBanner} role="status">
      Offline — phrasebook and recent translations still work.
    </div>
  );
};

const PlayHub: React.FC = () => {
  const [phase, setPhase] = useState<PlayPhase>('start');
  const [makeup, setMakeup] = useState<SessionMakeup | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [kidMode] = useState(() => getKidMode());

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

  if (phase === 'listen') {
    return (
      <AudioPick
        onDone={(r) => {
          setResult(r);
          setPhase('summary');
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

  if (phase === 'tonepop' || phase === 'readtone') {
    return (
      <TonePop
        kidMode={kidMode}
        mode={phase === 'readtone' ? 'read' : 'hear'}
        onDone={(r) => {
          setResult(r);
          setPhase('summary');
        }}
      />
    );
  }

  if (phase === 'dojo') {
    return (
      <TonePairDojo
        kidMode={kidMode}
        onDone={(r) => {
          setResult(r);
          setPhase('summary');
        }}
      />
    );
  }

  if (phase === 'echo') {
    return <EchoBooth />;
  }

  if (phase === 'script') {
    return <ScriptLadder />;
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
      kidMode={kidMode}
      onStart={(mode) => setPhase(mode)}
    />
  );
};

/**
 * Membership guard for the experience screens. A non-member must never reach a
 * screen that calls the Worker (Home prefetches TTS on mount; Translate/Deck
 * call translate()/tts()), or an anonymous visitor could drain Gemini/Azure
 * quota without joining (see status/bug_access-control.md). Rendered as a
 * layout route so a single useMember listener covers all the gated children.
 */
const RequireMembership: React.FC = () => {
  const { status } = useMember();

  if (status === 'loading' || status === 'joining') {
    return (
      <div className={styles.gateSplash} role="status" aria-live="polite">
        <span className={styles.gateSpinner} aria-hidden="true" />
      </div>
    );
  }

  if (status !== 'member') {
    return (
      <div className={styles.gate}>
        <span className={styles.gateKick}>Thaitor</span>
        <h1 className={styles.gateTitle}>Family members only</h1>
        <p className={styles.gateLede}>
          Thaitor is invite-only. Open the invite link a family member shared with you to
          join — then this screen unlocks.
        </p>
        <a className={styles.gateLink} href="#/join">
          I have an invite link →
        </a>
      </div>
    );
  }

  return <Outlet />;
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
  if (name === 'settings')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <path d="M5 4h10a2 2 0 0 1 2 2v14l-7-3-7 3V6a2 2 0 0 1 2-2z" />
      <path d="M9.5 9.5l1.2 1.2 2.3-2.3" />
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
  return (
    <nav className={styles.nav}>
      {TABS.map((tab) => {
        const active =
          pathname === tab.path ||
          (tab.path === '/translate' && pathname.startsWith('/translate'));
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
  // On boot, make sure at least one profile exists (first-run seeding) and that
  // the synchronous Kid Mode mirror reflects the active profile's stored value.
  useEffect(() => {
    (async () => {
      try {
        await listProfiles();
        await syncKidModeMirror();
        await applyActiveProfileVoices();
      } catch {
        /* ignore — IndexedDB may be unavailable */
      }
    })();
  }, []);

  return (
    <HashRouter>
      <div className={styles.shell}>
        <main className={styles.content}>
          <Routes>
            {/* Open routes. Join is the entry point; Settings self-gates with
                its own non-member prompt; Home works offline for anyone (its
                TTS prefetch is blocked server-side for non-members and falls
                back to browser speech — see status/bug_access-control.md). */}
            <Route path="/" element={<Home />} />
            <Route path="/join" element={<Join />} />
            <Route path="/settings" element={<Settings />} />
            {/* Member-only screens — these need live translation/audio, so a
                non-member can't use them and is shown the join wall. */}
            <Route element={<RequireMembership />}>
              <Route path="/translate" element={<Translate />} />
              <Route path="/translate/:from/:to" element={<Translate />} />
              <Route path="/play" element={<PlayHub />} />
              <Route path="/deck" element={<Deck />} />
              <Route path="/trace" element={<ToneTrace />} />
            </Route>
          </Routes>
        </main>
        <OfflineBanner />
        <BottomNav />
      </div>
    </HashRouter>
  );
};

export default Shell;
