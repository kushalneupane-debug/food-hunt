import { useState, useEffect } from 'react';
import { searchNearby } from './api';
import './App.css';
import AuthPanel from './AuthPanel';
import { getProfile } from './auth-api';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authScreen, setAuthScreen] = useState(null);
  // Keep the bearer token in memory; refreshing the page signs out.
  const [session, setSession] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState('All');

    const cuisineEmojis = {
    nepali: '🥟',
    mexican: '🌮',
    vietnamese: '🍜',
    'soul-food': '🍗',
    cajun: '🦐',
  };

  useEffect(() => {
    let active = true;
    searchNearby({ lat: 33.4251, lng: -94.0477 })
      .then((data) => {
        if (active) setResults(Array.isArray(data) ? data : (data.results || []));
      })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Default Texarkana coordinates
  const DEFAULT_LAT = 33.4251;
  const DEFAULT_LNG = -94.0477;

  // Execute database search via backend API
  const handleSearch = (lat = DEFAULT_LAT, lng = DEFAULT_LNG) => {
    setLoading(true);
    setError(null);
    searchNearby({ lat, lng, q: query })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        setResults(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // Browser Geolocation with Texarkana fallback
  const handleUseLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleSearch(pos.coords.latitude, pos.coords.longitude),
        () => handleSearch(DEFAULT_LAT, DEFAULT_LNG)
      );
    } else {
      handleSearch(DEFAULT_LAT, DEFAULT_LNG);
    }
  };


  const cuisines = [
    'All',
    ...new Set(
      results
        .map((item) => item.cuisine)
        .filter(Boolean)
        .map((cuisine) =>
          cuisine.replace(/\b\w/g, (char) => char.toUpperCase())
        )
    ),
  ];

  const filteredResults =
    selectedCuisine === 'All'
      ? results
      : results.filter(
          (item) =>
            item.cuisine?.toLowerCase() === selectedCuisine.toLowerCase()
        );
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
      setSession((current) => current ? { ...current, user } : null);
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
    return <>
      {profileError && <p className="auth-error" role="alert">{profileError}</p>}
      <AuthPanel screen={authScreen} user={session?.user}
        onClose={() => { setAuthScreen(null); setProfileError(''); }}
        onScreenChange={setAuthScreen}
        onLogin={(next) => { setSession(next); setProfileError(''); setAuthScreen('profile'); }}
        onLogout={signOut} />
    </>;
  }


  return (
    <div>
      {/* Navigation Bar */}
      <header className="navbar">
        <div className="logo">
          <div className="logo-icon">🍲</div>
          <div className="logo-text">
            <h1>Food Hunt</h1>
            <p>Real Food. Real Cultures.</p>
          </div>
        </div>
        <nav>
          <a href="#" className="active">Home</a>
          <a href="#restaurants">Restaurants</a>
          <a href="#about">About</a>
        </nav>
        <div className="nav-buttons">
          {session ? <>
            <button className="account-btn" onClick={openProfile} disabled={profileLoading}>
              {profileLoading ? 'Loading…' : 'My Profile'}
            </button>
            <button className="sign-out" onClick={signOut} disabled={profileLoading}>Sign Out</button>
          </> : <>
            <button className="sign-in" onClick={() => setAuthScreen('signin')}>Sign In</button>
            <button className="account-btn" onClick={() => setAuthScreen('signup')}>Create Account</button>
          </>}
        </div>

      </header>

      {profileError && <p className="auth-error" role="alert">{profileError}</p>}
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h2>Discover Authentic<br />Food Near You</h2>
          <p>Find local restaurants serving traditional dishes and authentic food from different cultures.</p>
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search restaurant or dish (e.g., momo, birria)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={() => handleSearch()}>Search</button>
            <button 
              onClick={handleUseLocation} 
              style={{ marginLeft: '8px', backgroundColor: '#14523d' }}
            >
              📍 Location
            </button>
          </div>
        </div>
      </section>

      {/* Restaurant Section */}
      <section className="section restaurants-section" id="restaurants">
        <div className="section-heading restaurant-heading">
          <div>
            <h2>Local Restaurants</h2>
            <p>Explore authentic food and local restaurants in the Texarkana area.</p>
          </div>
          <span className="restaurant-count">
            {results.length} Restaurants Found
          </span>
        </div>

        {loading && <p style={{ padding: '20px', textAlign: 'center' }}>Loading results from database...</p>}
        {error && <p style={{ color: 'red', padding: '20px' }}>Error: {error}</p>}


        <div className="cuisine-filters">
          {cuisines.map((cuisine) => (
            <button
              key={cuisine}
              className={`cuisine-chip ${
                selectedCuisine === cuisine ? 'selected' : ''
              }`}
              onClick={() => setSelectedCuisine(cuisine)}
            >
              {cuisine}
            </button>
          ))}
        </div>


        {/* Dynamic Restaurant Cards Grid */}
        <div className="restaurant-grid">
          {filteredResults.map((item, i) => (
            <article className="restaurant-card" key={item.id ?? i}>
              <div className="image-placeholder">
                <span>{item.name}</span>
              </div>

              <div className="restaurant-info">
                <h3>{item.name}</h3>

                <div className="restaurant-badges">
                  {item.vendorType === 'food-truck' && (
                    <span className="vendor-badge">🚚 Food Truck</span>
                  )}

                  {item.vendorType === 'pop-up' && (
                    <span className="vendor-badge">🎪 Pop-up</span>
                  )}

                  <span className="price-badge">
                    {item.priceLevel
                      ? '$'.repeat(Math.min(item.priceLevel, 3))
                      : 'Price N/A'}
                  </span>
                </div>

                <p className="restaurant-type">
                  {cuisineEmojis[item.cuisine?.toLowerCase()] || '🍽️'}{' '}
                  {item.cuisine
                    ? item.cuisine.replace(/\b\w/g, (char) => char.toUpperCase())
                    : 'Cuisine N/A'}
                </p>

                <div className="details">
                  <span>
                    ⭐ {item.rating ?? item.avgAuthenticity ?? 'Not rated'}
                  </span>
                </div>

                <p className="address">
                  📍 {item.address || 'Texarkana, TX'}
                </p>

                {item.distanceKm != null && (
                  <p className="description">
                    Distance: {item.distanceKm} km
                  </p>
                )}

                {item.matchedDishes?.length > 0 && (
                  <p className="description">
                    <strong>Dishes:</strong> {item.matchedDishes.join(', ')}
                  </p>
                )}
              </div>
            </article>

          ))}
        </div>

        {filteredResults.length === 0 && !loading && (
          <p className="no-results" style={{ display: 'block' }}>
            No restaurants found. Try searching for "momo" or "birria".
          </p>
        )}
      </section>
    </div>
  );
}
