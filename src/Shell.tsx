import { useCallback, useEffect, useState } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
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

/**
 * The Play flow is a set of distinct screens, each with its own hash route under
 * `/play` (see the route table below). The route — not component state — decides
 * which screen renders, so a screen is reachable and refreshable by URL.
 *
 * The one piece of genuinely transient data is the just-finished session result
 * that the summary screen reports on. It can't live in the URL, so this layout
 * holds it and hands it down (plus Kid Mode) through the outlet context. A drill
 * calls `finish(result)`, which stashes the result and navigates to the summary;
 * landing on `/play/summary` with no result (a refresh or deep link) bounces back
 * to the session start.
 */
type PlayContext = {
  kidMode: boolean;
  result: SessionResult | null;
  finish: (result: SessionResult) => void;
};

const PlayLayout: React.FC = () => {
  const navigate = useNavigate();
  const [kidMode] = useState(() => getKidMode());
  const [result, setResult] = useState<SessionResult | null>(null);

  const finish = useCallback(
    (r: SessionResult) => {
      setResult(r);
      navigate('/play/summary');
    },
    [navigate],
  );

  const ctx: PlayContext = { kidMode, result, finish };
  return <Outlet context={ctx} />;
};

const usePlay = () => useOutletContext<PlayContext>();

const PlayStart: React.FC = () => {
  const { kidMode } = usePlay();
  const navigate = useNavigate();
  const [makeup, setMakeup] = useState<SessionMakeup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await buildSession();
      if (!cancelled) setMakeup(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      onStart={(mode) => navigate(`/play/${mode}`)}
    />
  );
};

const PlayAudioPick: React.FC = () => {
  const { finish } = usePlay();
  return <AudioPick onDone={finish} />;
};

const PlayExercise: React.FC = () => {
  const { finish } = usePlay();
  return <Exercise onDone={finish} />;
};

const PlayTonePop: React.FC<{ mode: 'hear' | 'read' }> = ({ mode }) => {
  const { kidMode, finish } = usePlay();
  return <TonePop kidMode={kidMode} mode={mode} onDone={finish} />;
};

const PlayDojo: React.FC = () => {
  const { kidMode, finish } = usePlay();
  return <TonePairDojo kidMode={kidMode} onDone={finish} />;
};

const PlaySummary: React.FC = () => {
  const { result } = usePlay();
  const navigate = useNavigate();
  if (!result) return <Navigate to="/play" replace />;
  return <SessionSummary result={result} onDone={() => navigate('/play')} />;
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
          (tab.path !== '/' && pathname.startsWith(`${tab.path}/`));
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
              {/* Each Play screen owns a hash route; the route is the source of
                  truth for which one renders (see PlayLayout). */}
              <Route path="/play" element={<PlayLayout />}>
                <Route index element={<PlayStart />} />
                <Route path="listen" element={<PlayAudioPick />} />
                <Route path="build" element={<PlayExercise />} />
                <Route path="tonepop" element={<PlayTonePop mode="hear" />} />
                <Route path="readtone" element={<PlayTonePop mode="read" />} />
                <Route path="dojo" element={<PlayDojo />} />
                <Route path="echo" element={<EchoBooth />} />
                <Route path="script" element={<ScriptLadder />} />
                <Route path="script/:rungId" element={<ScriptLadder />} />
                <Route path="script/:rungId/:mode" element={<ScriptLadder />} />
                <Route path="summary" element={<PlaySummary />} />
              </Route>
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
