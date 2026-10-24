import { CATEGORIES } from '../categories';

const QUICK_IDEAS = ['momo', 'tacos', 'boba', 'pho', 'kolache', 'coffee'];

export default function Hero({ query, onQueryChange, onSearch, onUseLocation, locating, locationNote, onPickCategory }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__text">
        <h2 id="hero-title">What are you hungry for, Texarkana?</h2>
        <p className="hero__lede">
          Family kitchens, coffee spots, bakeries and international markets, found by the thing you
          actually want.
        </p>

        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(query);
          }}
        >
          <label htmlFor="q" className="visually-hidden">
            Search by dish, drink or place
          </label>
          <input
            id="q"
            type="search"
            autoComplete="off"
            placeholder="Try momo, boba, conchas…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <button type="submit" className="btn btn--ink">
            Search
          </button>
        </form>

        <div className="hero__under">
          <p className="ideas">
            <span>Popular:</span>
            {QUICK_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                className="idea"
                onClick={() => {
                  onQueryChange(idea);
                  onSearch(idea);
                }}
              >
                {idea}
              </button>
            ))}
          </p>
          <button type="button" className="locate" onClick={onUseLocation} disabled={locating}>
            📍 {locating ? 'Finding you…' : 'Use my location'}
          </button>
        </div>
        {locationNote && <p className="hero__note">{locationNote}</p>}
      </div>

      {/* The four category "stickers": the playful, memorable part of the page */}
      <div className="stickers" aria-label="Browse by category">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`sticker sticker--${i}`}
            style={{ '--tone': c.color }}
            onClick={() => onPickCategory(c.id)}
          >
            <span className="sticker__emoji" aria-hidden="true">
              {c.emoji}
            </span>
            <span className="sticker__label">{c.label}</span>
            <span className="sticker__blurb">{c.blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
