import { useEffect, useMemo, useRef, useState } from 'react';
import { searchNearby } from './api';
import { getProfile } from './auth-api';
import AuthPanel from './AuthPanel';
import CravingMap from './components/CravingMap';
import Hero from './components/Hero';
import PlaceCard from './components/PlaceCard';
import PlaceDrawer from './components/PlaceDrawer';
import Spotlight from './components/Spotlight';
import { CATEGORIES, chipInfo, chipKey } from './categories';
import './App.css';

const TEXARKANA = { lat: 33.4251, lng: -94.0477 };
const RADIUS_KM = 40; // about 25 miles

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [where, setWhere] = useState(TEXARKANA);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');

  const [category, setCategory] = useState('all');
  const [chip, setChip] = useState(null);
  const [openId, setOpenId] = useState(null);

  // What the server understood the craving as ("tocos" -> tacos), how to sort, and which place is highlighted.
  const [craving, setCraving] = useState(null);
  const [sort, setSort] = useState('near');
  const [focusId, setFocusId] = useState(null);

  // "Can't decide?" spin state
  const [litId, setLitId] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const spinTimer = useRef(null);

  // Auth (unchanged behaviour): token kept in memory, so refreshing signs out.
  const [authScreen, setAuthScreen] = useState(null);
  const [session, setSession] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const resultsRef = useRef(null);

  async function runSearch(q = query, at = where) {
    setLoading(true);
    setError('');
    setPickedId(null);
    setFocusId(null);
    try {
      const data = await searchNearby({ lat: at.lat, lng: at.lng, q: q.trim(), radiusKm: RADIUS_KM });
      setResults(data.results || []);
      setCraving(data.craving?.query ? data.craving : null);
      // Jump straight to the answer after a craving search.
      if (q.trim()) {
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // First load: everything near Texarkana (loading already starts as true).
  useEffect(() => {
    let active = true;
    searchNearby({ ...TEXARKANA, radiusKm: RADIUS_KM })
      .then((data) => active && setResults(data.results || []))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    const timer = spinTimer;
    return () => {
      active = false;
      clearInterval(timer.current);
    };
  }, []);

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setLocationNote('This browser can’t share location, so we’re showing Texarkana.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setWhere(here);
        setLocationNote('');
        setLocating(false);
        runSearch(query, here);
      },
      () => {
        setLocationNote(
          window.isSecureContext
            ? 'Location is turned off for this site, so we’re showing Texarkana.'
            : 'Browsers only share location on secure (https) sites, so we’re showing Texarkana.'
        );
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  function pickCategory(id) {
    setCategory(id);
    setChip(null);
    setPickedId(null);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const counts = useMemo(() => {
    const byCat = { all: results.length };
    for (const r of results) byCat[r.category || 'eat'] = (byCat[r.category || 'eat'] || 0) + 1;
    return byCat;
  }, [results]);

  const inCategory = useMemo(
    () => (category === 'all' ? results : results.filter((r) => (r.category || 'eat') === category)),
    [results, category]
  );

  const chips = useMemo(() => {
    if (category === 'all') return [];
    const seen = new Map();
    for (const r of inCategory) seen.set(chipKey(r), (seen.get(chipKey(r)) || 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [inCategory, category]);

  // Memoized so the map only redraws when the results really change (not on every hover).
  const filtered = useMemo(
    () => (chip ? inCategory.filter((r) => chipKey(r) === chip) : inCategory),
    [inCategory, chip]
  );

  // Results come back closest first. "Top rated" puts reviewed places first, closest breaking ties.
  const visible = useMemo(
    () =>
      sort === 'top'
        ? [...filtered].sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || a.distanceKm - b.distanceKm)
        : filtered,
    [filtered, sort]
  );
  const nearest = filtered.reduce((best, p) => (!best || p.distanceKm < best.distanceKm ? p : best), null);
  const topRated = filtered.reduce(
    (best, p) => (p.avgRating != null && (!best || p.avgRating > best.avgRating) ? p : best),
    null
  );

  // Tapping a pin highlights its card and scrolls it into view.
  function focusPlace(id) {
    setFocusId(id);
    document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Shuffle a highlight across the cards, then land on one at random.
  function spin() {
    if (visible.length === 0) return;
    clearInterval(spinTimer.current);
    const final = visible[Math.floor(Math.random() * visible.length)];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const land = () => {
      setLitId(null);
      setPickedId(final.id);
      document.getElementById(`place-${final.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    if (reduce || visible.length === 1) return land();
    let ticks = 0;
    setPickedId(null);
    spinTimer.current = setInterval(() => {
      ticks += 1;
      setLitId(visible[ticks % visible.length].id);
      if (ticks >= 14) {
        clearInterval(spinTimer.current);
        land();
      }
    }, 90);
  }

  function signOut() {
    setSession(null);
    setAuthScreen(null);
    setProfileError('');
  }

  async function openProfile() {
    setProfileLoading(true);
    setProfileError('');
    try {
      const { user } = await getProfile(session.token);
      setSession((current) => (current ? { ...current, user } : null));
      setAuthScreen('profile');
    } catch (failure) {
      if (failure.status === 401) {
        setSession(null);
        setAuthScreen('signin');
        setProfileError('Your session expired. Please sign in again.');
      } else {
        setProfileError(failure.message);
      }
    } finally {
      setProfileLoading(false);
    }
  }

  if (authScreen) {
    return (
      <>
        {profileError && (
          <p className="auth-error" role="alert">
            {profileError}
          </p>
        )}
        <AuthPanel
          screen={authScreen}
          user={session?.user}
          onClose={() => {
            setAuthScreen(null);
            setProfileError('');
          }}
          onScreenChange={setAuthScreen}
          onLogin={(next) => {
            setSession(next);
            setProfileError('');
            setAuthScreen('profile');
          }}
          onLogout={signOut}
        />
      </>
    );
  }

  const activeCat = CATEGORIES.find((c) => c.id === category);
  const heading = craving
    ? `${visible.length} ${visible.length === 1 ? 'place' : 'places'} for ${craving.query} near you`
    : activeCat
      ? `${activeCat.label}: ${visible.length} ${visible.length === 1 ? 'spot' : 'spots'} nearby`
      : `${visible.length} local spots nearby`;

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand__mark" aria-hidden="true">
            🍲
          </span>
          Food Hunt
        </a>
        <nav className="topbar__nav" aria-label="Main">
          <a href="#places">Places</a>
          <a href="#about">About</a>
        </nav>
        <div className="topbar__account">
          {session ? (
            <>
              <button className="btn btn--ghost" onClick={openProfile} disabled={profileLoading}>
                {profileLoading ? 'Loading…' : 'My profile'}
              </button>
              <button className="btn btn--link" onClick={signOut} disabled={profileLoading}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--link" onClick={() => setAuthScreen('signin')}>
                Sign in
              </button>
              <button className="btn btn--ink" onClick={() => setAuthScreen('signup')}>
                Create account
              </button>
            </>
          )}
        </div>
      </header>

      {profileError && (
        <p className="auth-error" role="alert">
          {profileError}
        </p>
      )}

      <main>
        <Hero
          query={query}
          onQueryChange={setQuery}
          onSearch={(q) => runSearch(q)}
          onUseLocation={locateMe}
          locating={locating}
          locationNote={locationNote}
          onPickCategory={pickCategory}
        />

        <section className="places" id="places" ref={resultsRef} aria-busy={loading}>
          <div className="tabs" role="tablist" aria-label="Category">
            <button role="tab" aria-selected={category === 'all'} className="tab" onClick={() => pickCategory('all')}>
              Everything <span className="tab__n">{counts.all || 0}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={category === c.id}
                className="tab"
                style={{ '--tone': c.color }}
                onClick={() => pickCategory(c.id)}
              >
                <span aria-hidden="true">{c.emoji}</span> {c.label} <span className="tab__n">{counts[c.id] || 0}</span>
              </button>
            ))}
          </div>

          <div className="places__head">
            <div>
              <h2>{error ? 'Search isn’t working right now' : heading}</h2>
              {chips.length > 1 && (
                <div className="chips">
                  <button className="chip" aria-pressed={chip === null} onClick={() => setChip(null)}>
                    All
                  </button>
                  {chips.map(([key, n]) => {
                    const info = chipInfo(category, key);
                    return (
                      <button key={key} className="chip" aria-pressed={chip === key} onClick={() => setChip(key)}>
                        <span aria-hidden="true">{info.emoji}</span> {info.label} <span className="tab__n">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button className="spin" onClick={spin} disabled={visible.length < 2}>
              <span aria-hidden="true">🎲</span> Can’t decide? Spin
            </button>
          </div>

          {error && (
            <div className="empty">
              <p>{error}. Check your connection and try again.</p>
              <button className="btn btn--ink" onClick={() => runSearch()}>
                Try again
              </button>
            </div>
          )}

          {!error && loading && results.length === 0 && <p className="muted">Finding places…</p>}

          {craving?.corrected && (
            <p className="fixed-typo">
              Showing results for <strong>{craving.query}</strong> (you typed “{craving.typed}”).
            </p>
          )}

          {!error && craving && nearest && (
            <Spotlight craving={craving.query} nearest={nearest} topRated={topRated} onOpen={setOpenId} onFocus={focusPlace} />
          )}

          {!error && visible.length > 0 && (
            <div className="split">
              <div className="split__list">
                <div className="sort" role="group" aria-label="Sort places">
                  <button aria-pressed={sort === 'near'} onClick={() => setSort('near')}>
                    Closest
                  </button>
                  <button aria-pressed={sort === 'top'} onClick={() => setSort('top')}>
                    Top rated
                  </button>
                </div>
                <div className="grid grid--list">
                  {visible.map((p, i) => (
                    <PlaceCard
                      key={p.id}
                      place={p}
                      number={i + 1}
                      onOpen={setOpenId}
                      onFocus={setFocusId}
                      highlighted={litId === p.id}
                      focused={focusId === p.id}
                      picked={pickedId === p.id}
                    />
                  ))}
                </div>
              </div>
              <div className="split__map">
                <CravingMap
                  places={visible}
                  origin={where}
                  nearestId={nearest?.id}
                  focusId={litId ?? focusId}
                  onSelect={focusPlace}
                />
              </div>
            </div>
          )}

          {!error && !loading && visible.length === 0 && (
            <div className="empty">
              <p>
                {query.trim()
                  ? `No place nearby has ${craving?.query || query.trim()} yet. Try another craving, or tell us where to find it.`
                  : 'No places in this category yet. Know a good one? Tell us.'}
              </p>
              <div className="empty__actions">
                {query && (
                  <button
                    className="btn btn--ink"
                    onClick={() => {
                      setQuery('');
                      runSearch('');
                    }}
                  >
                    Clear search
                  </button>
                )}
                {category !== 'all' && (
                  <button className="btn btn--ghost" onClick={() => pickCategory('all')}>
                    Show everything
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="footer" id="about">
        <div>
          <p className="footer__brand">Food Hunt</p>
          <p>
            We help small, family-run food businesses in Texarkana get found: kitchens, trucks, cafés,
            bakeries and international markets. Only licensed vendors are listed.
          </p>
        </div>
        <p className="muted">Built by The Creators at Texas A&amp;M University-Texarkana.</p>
      </footer>

      {openId && <PlaceDrawer key={openId} id={openId} onClose={() => setOpenId(null)} userName={session?.user?.name} />}
    </div>
  );
}
