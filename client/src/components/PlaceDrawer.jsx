import { useEffect, useRef, useState } from 'react';
import { createReview, getBusiness } from '../api';
import { cuisineColor, cuisineName, dollars, priceLabel, splitSample, vendorName } from '../format';

const SCORES = [
  { key: 'authenticity', label: 'Authenticity' },
  { key: 'taste', label: 'Taste' },
  { key: 'value', label: 'Value' },
];

const average = (reviews, key) =>
  reviews.length ? reviews.reduce((sum, r) => sum + r[key], 0) / reviews.length : null;

function ScorePicker({ label, value, onChange }) {
  return (
    <fieldset className="score">
      <legend>{label}</legend>
      <div className="score__options">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="score__option">
            <input type="radio" name={label} value={n} checked={value === n} onChange={() => onChange(n)} />
            <span>{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewForm({ businessId, defaultName, onPosted }) {
  const [form, setForm] = useState({ authorName: defaultName || '', authenticity: 0, taste: 0, value: 0, comment: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const ready = form.authorName.trim() && form.authenticity && form.taste && form.value;

  async function submit(e) {
    e.preventDefault();
    if (!ready) {
      setStatus({ state: 'error', message: 'Add your name and pick a score for authenticity, taste and value.' });
      return;
    }
    setStatus({ state: 'saving', message: '' });
    try {
      await createReview(businessId, {
        authorName: form.authorName.trim(),
        authenticity: form.authenticity,
        taste: form.taste,
        value: form.value,
        ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
      });
      setForm((f) => ({ ...f, authenticity: 0, taste: 0, value: 0, comment: '' }));
      setStatus({ state: 'done', message: 'Review posted. Thanks for helping people find real food.' });
      onPosted();
    } catch (err) {
      setStatus({ state: 'error', message: err.message });
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <h3>Write a review</h3>
      <label className="field">
        <span>Your name</span>
        <input value={form.authorName} onChange={(e) => set('authorName')(e.target.value)} maxLength={60} />
      </label>
      {SCORES.map((s) => (
        <ScorePicker key={s.key} label={s.label} value={form[s.key]} onChange={set(s.key)} />
      ))}
      <label className="field">
        <span>What should people order? (optional)</span>
        <textarea rows={3} value={form.comment} onChange={(e) => set('comment')(e.target.value)} maxLength={1000} />
      </label>
      {status.message && (
        <p className={`form-status form-status--${status.state}`} role="status">
          {status.message}
        </p>
      )}
      <button className="btn btn--primary" type="submit" disabled={status.state === 'saving'}>
        {status.state === 'saving' ? 'Posting…' : 'Post review'}
      </button>
    </form>
  );
}

export default function PlaceDrawer({ id, onClose, userName }) {
  const [place, setPlace] = useState(null);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  const load = () =>
    getBusiness(id)
      .then((p) => {
        setPlace(p);
        setError(null);
      })
      .catch((err) => setError(err.message));

  // App gives this component key={id}, so each place starts fresh.
  useEffect(() => {
    load();
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const display = place ? splitSample(place.name) : null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(e) => e.stopPropagation()}
        style={place ? { '--lamp': cuisineColor(place.cuisine) } : undefined}
      >
        <button ref={closeRef} className="drawer__close" onClick={onClose}>
          Close
        </button>

        {error && <p className="form-status form-status--error">Couldn&rsquo;t load this place: {error}</p>}
        {!place && !error && <p className="drawer__loading">Loading…</p>}

        {place && (
          <>
            <header className="drawer__head">
              <p className="drawer__cuisine">
                <span className="board__lamp" aria-hidden="true" />
                {cuisineName(place.cuisine)}
              </p>
              <h2 id="drawer-title">{display.name}</h2>
              <p className="place__meta">
                <span className="tag">{vendorName(place.vendorType)}</span>
                <span className="tag">{priceLabel(place.priceLevel)}</span>
                {place.isLicensed && <span className="tag">Licensed vendor</span>}
                {display.isSample && <span className="tag tag--sample">Sample listing</span>}
              </p>
              <p className="drawer__address">{place.address}</p>
            </header>

            {(place.story || place.description) && (
              <blockquote className="drawer__story">
                {place.story && <p>{place.story}</p>}
                {place.description && <p className="drawer__desc">{place.description}</p>}
              </blockquote>
            )}

            <section className="drawer__block">
              <h3>Menu</h3>
              {place.dishes.length === 0 ? (
                <p className="muted">No dishes listed yet.</p>
              ) : (
                <ul className="menu">
                  {place.dishes.map((d) => (
                    <li key={d.id} className="menu__item">
                      <span className="place__line">
                        <span className="menu__name">
                          {d.name}
                          {d.isVegetarian && (
                            <abbr className="veg" title="Vegetarian">
                              V
                            </abbr>
                          )}
                        </span>
                        <span className="place__leader" aria-hidden="true" />
                        <span className="menu__price">{dollars(d.priceCents)}</span>
                      </span>
                      {d.description && <span className="menu__desc">{d.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="drawer__block">
              <h3>
                Reviews <span className="muted">({place.reviews.length})</span>
              </h3>
              {place.reviews.length > 0 && (
                <dl className="scores">
                  {SCORES.map((s) => {
                    const avg = average(place.reviews, s.key);
                    return (
                      <div key={s.key} className="scores__row">
                        <dt>{s.label}</dt>
                        <dd>
                          <span className="scores__bar">
                            <span style={{ width: `${(avg / 5) * 100}%` }} />
                          </span>
                          {avg.toFixed(1)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              {place.reviews.length === 0 && <p className="muted">No reviews yet. Be the first.</p>}
              <ul className="reviews">
                {place.reviews.map((r) => (
                  <li key={r.id}>
                    <p className="reviews__who">
                      {r.authorName}
                      <span className="muted">
                        {' '}
                        authenticity {r.authenticity}, taste {r.taste}, value {r.value}
                      </span>
                    </p>
                    {r.comment && <p>{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </section>

            <ReviewForm businessId={place.id} defaultName={userName} onPosted={load} />
          </>
        )}
      </aside>
    </div>
  );
}
