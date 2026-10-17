import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMe, searchNearby } from './api';
import { FEATURED_CUISINES, KM_PER_MILE, cuisineName } from './format';
import Hero from './components/Hero';
import CategoryTabs from './components/CategoryTabs';
import MenuBoard from './components/MenuBoard';
import PlaceDrawer from './components/PlaceDrawer';
import AuthDialog from './components/AuthDialog';
import './App.css';

const TEXARKANA = { lat: 33.4251, lng: -94.0477, label: 'Texarkana' };
const TOKEN_KEY = 'foodhunt.token';

// Browser storage can be blocked (private mode), so never let it crash the app.
const storage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export default function App() {
  const [query, setQuery] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [place, setPlace] = useState(TEXARKANA);
  const [locationNote, setLocationNote] = useState('');
  const [locating, setLocating] = useState(false);

  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  const [category, setCategory] = useState('all');
  const [otherCuisine, setOtherCuisine] = useState(null);
  const [openId, setOpenId] = useState(null);

  const [session, setSession] = useState({ token: storage.get(), user: null });
  const [authMode, setAuthMode] = useState(null); // null | 'login' | 'register'

  const runSearch = useCallback(
    async (q) => {
      setStatus('loading');
      try {
        const data = await searchNearby({
          lat: place.lat,
          lng: place.lng,
          q: q.trim(),
          radiusKm: Math.min(100, Math.round(radiusMiles * KM_PER_MILE)),
        });
        setResults(data.results || []);
        setStatus('ready');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    },
    [place, radiusMiles]
  );

  // Search as you type (after a short pause), and whenever distance or location changes.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // Restore a saved login.
  useEffect(() => {
    if (!session.token || session.user) return;
    getMe(session.token)
      .then(({ user }) => setSession((s) => ({ ...s, user })))
      .catch(() => {
        storage.set(null);
        setSession({ token: null, user: null });
      });
  }, [session.token, session.user]);

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setLocationNote('This browser can’t share location, so we’re showing Texarkana.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'you' });
        setLocationNote('');
        setLocating(false);
      },
      () => {
        setLocationNote(
          window.isSecureContext
            ? 'Location is turned off for this site, so we’re showing Texarkana.'
            : 'Browsers only share location over a secure (https) connection, so we’re showing Texarkana.'
        );
        setPlace(TEXARKANA);
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  const counts = useMemo(() => {
    const byCuisine = {};
    for (const r of results) byCuisine[r.cuisine] = (byCuisine[r.cuisine] || 0) + 1;
    const featured = FEATURED_CUISINES.reduce((n, c) => n + (byCuisine[c] || 0), 0);
    return { all: results.length, other: results.length - featured, byCuisine };
  }, [results]);

  const visible = useMemo(() => {
    if (category === 'all') return results;
    if (category === 'other') {
      return results.filter((r) =>
        otherCuisine ? r.cuisine === otherCuisine : !FEATURED_CUISINES.includes(r.cuisine)
      );
    }
    return results.filter((r) => r.cuisine === category);
  }, [results, category, otherCuisine]);

  function signedIn({ token, user }) {
    storage.set(token);
    setSession({ token, user });
    setAuthMode(null);
  }

  function signOut() {
    storage.set(null);
    setSession({ token: null, user: null });
  }

  const noun = visible.length === 1 ? 'place' : 'places';
  const scopeName =
    category === 'all'
      ? noun
      : category === 'other'
        ? otherCuisine
          ? `${cuisineName(otherCuisine)} ${noun}`
          : `${noun} in other cuisines`
        : `${cuisineName(category)} ${noun}`;
  const scopeCuisine =
    category === 'other' ? (otherCuisine ? cuisineName(otherCuisine) : 'other cuisines') : cuisineName(category);

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Food Hunt home">
          <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M8 28h48a24 24 0 0 1-48 0z" fill="currentColor" />
            <path d="M22 20c0-4 4-4 4-8M32 20c0-4 4-4 4-8M42 20c0-4 4-4 4-8" stroke="var(--chili)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </svg>
          Food Hunt
        </a>
        <div className="topbar__account">
          {session.user ? (
            <>
              <span className="topbar__hello">Hi, {session.user.name.split(' ')[0]}</span>
              <button className="btn btn--ghost" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--ghost" onClick={() => setAuthMode('login')}>
                Sign in
              </button>
              <button className="btn btn--lantern" onClick={() => setAuthMode('register')}>
                Create account
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        <Hero
          query={query}
          onQueryChange={setQuery}
          onSubmit={() => runSearch(query)}
          locationLabel={place.label}
          locationNote={locationNote}
          onUseLocation={useMyLocation}
          locating={locating}
          radiusMiles={radiusMiles}
          onRadiusChange={setRadiusMiles}
        />

        <section className="results" aria-labelledby="results-title" aria-busy={status === 'loading'}>
          <div className="results__head">
            <h2 id="results-title">
              {status === 'error'
                ? 'Search isn’t working right now'
                : query.trim()
                  ? `${visible.length} ${scopeName} serving “${query.trim()}”`
                  : `${visible.length} ${scopeName} near ${place.label}`}
            </h2>
            <p className="muted">Nearest first. Tap a place for its menu and reviews.</p>
          </div>

          <CategoryTabs
            category={category}
            onCategoryChange={(c) => {
              setCategory(c);
              setOtherCuisine(null);
            }}
            otherCuisine={otherCuisine}
            onOtherCuisineChange={setOtherCuisine}
            counts={counts}
          />

          {status === 'error' && (
            <div className="empty">
              <p>{error}. Check your connection and try again.</p>
              <button className="btn btn--primary" onClick={() => runSearch(query)}>
                Try again
              </button>
            </div>
          )}

          {status !== 'error' && visible.length > 0 && <MenuBoard places={visible} onOpen={setOpenId} />}

          {status === 'ready' && visible.length === 0 && (
            <div className="empty">
              <p>
                Nothing {category === 'all' ? '' : `in ${scopeCuisine} `}
                {query.trim() ? `serves “${query.trim()}” ` : ''}within {radiusMiles} miles yet.
              </p>
              <div className="empty__actions">
                {radiusMiles < 60 && (
                  <button className="btn btn--primary" onClick={() => setRadiusMiles(60)}>
                    Search 60 miles
                  </button>
                )}
                {category !== 'all' && (
                  <button className="btn btn--ghost-dark" onClick={() => setCategory('all')}>
                    Show all cuisines
                  </button>
                )}
                {query && (
                  <button className="btn btn--ghost-dark" onClick={() => setQuery('')}>
                    Clear search
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>
          <strong>Food Hunt</strong> helps small, family-run food businesses get found. Built by The Creators at
          Texas A&amp;M University-Texarkana.
        </p>
        <p className="muted">Only licensed food vendors are listed.</p>
      </footer>

      {openId && <PlaceDrawer key={openId} id={openId} onClose={() => setOpenId(null)} userName={session.user?.name} />}
      {authMode && (
        <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onSignedIn={signedIn} />
      )}
    </div>
  );
}
