import { useEffect, useState } from 'react';

const DISHES = ['momo', 'birria tacos', 'pho', 'ramen', 'dumplings', 'étouffée', 'dal bhat', 'banh mi'];
const RADIUS_MILES = [5, 15, 30, 60];

// Types dish names into the empty search box, one letter at a time,
// so people see right away that they can search by dish.
function useCyclingDish(active) {
  const [text, setText] = useState(DISHES[0]);

  useEffect(() => {
    if (!active) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let dish = 0;
    let len = DISHES[0].length;
    let deleting = true;
    let timer;
    const tick = () => {
      let pause;
      if (deleting) {
        len -= 1;
        pause = 45;
        if (len === 0) {
          deleting = false;
          dish = (dish + 1) % DISHES.length;
          pause = 250;
        }
      } else {
        len += 1;
        pause = 90;
        if (len === DISHES[dish].length) {
          deleting = true;
          pause = 1700; // hold the full word
        }
      }
      setText(DISHES[dish].slice(0, len));
      timer = setTimeout(tick, pause);
    };
    timer = setTimeout(tick, 1700);
    return () => clearTimeout(timer);
  }, [active]);

  return text;
}

export default function Hero({
  query,
  onQueryChange,
  onSubmit,
  locationLabel,
  locationNote,
  onUseLocation,
  locating,
  radiusMiles,
  onRadiusChange,
}) {
  const [focused, setFocused] = useState(false);
  const placeholder = useCyclingDish(!focused && query === '');

  return (
    <section className="hero" aria-labelledby="hero-label">
      <form
        className="hero__form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label id="hero-label" htmlFor="dish" className="hero__lead">
          I&rsquo;m craving
        </label>
        <div className="hero__field">
          <input
            id="dish"
            className="hero__input"
            type="search"
            autoComplete="off"
            spellCheck="false"
            value={query}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <button type="submit" className="hero__go">
            Find it
          </button>
        </div>

        <p className="hero__where">
          <span>
            Within{' '}
            <select
              className="hero__select"
              value={radiusMiles}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              aria-label="Search distance"
            >
              {RADIUS_MILES.map((m) => (
                <option key={m} value={m}>
                  {m} miles
                </option>
              ))}
            </select>{' '}
            of <strong>{locationLabel}</strong>
          </span>
          <button type="button" className="hero__locate" onClick={onUseLocation} disabled={locating}>
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
        </p>
        {locationNote && <p className="hero__note">{locationNote}</p>}
      </form>

      <p className="hero__pitch">
        Family kitchens, food trucks and pop-ups around Texarkana, found by the dish you want
        instead of the biggest ad budget.
      </p>
    </section>
  );
}
