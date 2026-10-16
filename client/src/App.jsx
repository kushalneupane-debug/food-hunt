import { useState } from 'react';
import { searchNearby } from './api';
import './App.css';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div>
      {/* Navigation Bar */}
      <header className="navbar">
        <div className="logo">
          <div className="logo-icon">🍲</div>
          <div>
            <h1>The Creators</h1>
            <p>Real Food. Real Cultures.</p>
          </div>
        </div>
        <nav>
          <a href="#" className="active">Home</a>
          <a href="#restaurants">Restaurants</a>
          <a href="#about">About</a>
        </nav>
        <div className="nav-buttons">
          <button className="sign-in">♙ &nbsp; Sign In</button>
          <button className="account-btn">Create Account</button>
        </div>
      </header>

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

        {/* Dynamic Restaurant Cards Grid */}
        <div className="restaurant-grid">
          {results.map((item, i) => (
            <article className="restaurant-card" key={i}>
              <div className="image-placeholder">
                <span>{item.name}</span>
              </div>
              <div className="restaurant-info">
                <h3>{item.name}</h3>
                <p className="restaurant-type">🍽️ {item.cuisine || 'Cuisine N/A'}</p>
                <div className="details">
                  <span>⭐ {item.rating || '4.5'}</span>
                </div>
                <p className="address">📍 {item.address || 'Texarkana, TX'}</p>
                {item.distanceKm && (
                  <p className="description">Distance: {item.distanceKm} km</p>
                )}
                {item.matchedDishes && (
                  <p className="description">
                    <strong>Dishes:</strong> {item.matchedDishes.join(', ')}
                  </p>
                )}
                <button className="reserve-btn">Reserve a Table</button>
              </div>
            </article>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <p className="no-results" style={{ display: 'block' }}>
            No restaurants found. Try searching for "momo" or "birria".
          </p>
        )}
      </section>
    </div>
  );
}