import { useEffect, useRef, useState } from 'react';
import { createReview, getBusiness } from '../api';
import { categoryById, directionsUrl, dollars, placeKind, priceLabel, splitSample, vendorLabel } from '../categories';

const SCORES = [
  { key: 'authenticity', label: 'Authenticity' },
  { key: 'taste', label: 'Taste' },
  { key: 'value', label: 'Value' },
];

const average = (reviews, key) => reviews.reduce((sum, r) => sum + r[key], 0) / reviews.length;

function ReviewForm({ placeId, defaultName, onPosted }) {
  const [form, setForm] = useState({ authorName: defaultName || '', authenticity: 0, taste: 0, value: 0, comment: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.authorName.trim() || !form.authenticity || !form.taste || !form.value) {
      setStatus({ state: 'error', message: 'Add your name and tap a score for each of the three ratings.' });
      return;
    }
    setStatus({ state: 'saving', message: '' });
    try {
      await createReview(placeId, {
        authorName: form.authorName.trim(),
        authenticity: form.authenticity,
        taste: form.taste,
        value: form.value,
        ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
      });
      setForm((f) => ({ ...f, authenticity: 0, taste: 0, value: 0, comment: '' }));
      setStatus({ state: 'done', message: 'Review posted. Thanks for helping people find good food.' });
      onPosted();
    } catch (err) {
      setStatus({ state: 'error', message: err.message });
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <h3>Been here? Rate it</h3>
      <label className="field">
        <span>Your name</span>
        <input value={form.authorName} maxLength={60} onChange={(e) => set('authorName', e.target.value)} />
      </label>
      {SCORES.map((s) => (
        <fieldset key={s.key} className="score">
          <legend>{s.label}</legend>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="score__dot">
              <input type="radio" name={s.key} checked={form[s.key] === n} onChange={() => set(s.key, n)} />
              <span>{n}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <label className="field">
        <span>What should people order? (optional)</span>
        <textarea rows={3} maxLength={1000} value={form.comment} onChange={(e) => set('comment', e.target.value)} />
      </label>
      {status.message && (
        <p className={`form-msg form-msg--${status.state}`} role="status">
          {status.message}
        </p>
      )}
      <button className="btn btn--ink" type="submit" disabled={status.state === 'saving'}>
        {status.state === 'saving' ? 'Posting…' : 'Post review'}
      </button>
    </form>
  );
}

export default function PlaceDrawer({ id, onClose, userName }) {
  const [place, setPlace] = useState(null);
  const [error, setError] = useState('');
  const closeRef = useRef(null);

  const load = () =>
    getBusiness(id)
      .then((p) => {
        setPlace(p);
        setError('');
      })
      .catch((err) => setError(err.message));

  // App renders this with key={id}, so each place starts fresh.
  useEffect(() => {
    load();
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cat = place ? categoryById(place.category || 'eat') : null;
  const display = place ? splitSample(place.name) : null;

  return (
    <div className="backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(e) => e.stopPropagation()}
        style={cat ? { '--tone': cat.color } : undefined}
      >
        <button ref={closeRef} className="drawer__close" onClick={onClose}>
          Close
        </button>
        {error && <p className="form-msg form-msg--error">Couldn't load this place: {error}</p>}
        {!place && !error && <p>Loading…</p>}

        {place && (
          <>
            <header className="drawer__head">
              <p className="drawer__kind">
                <span aria-hidden="true">{placeKind(place).emoji}</span> {placeKind(place).label}
              </p>
              <h2 id="drawer-title">{display.name}</h2>
              <p className="card__meta">
                <span>{vendorLabel(place.vendorType)}</span>
                <span>{priceLabel(place.priceLevel)}</span>
                {place.isLicensed && <span>Licensed vendor</span>}
                {display.isSample && <span className="tag-sample">Sample</span>}
              </p>
              <p className="drawer__address">{place.address}</p>
              <a className="btn btn--ink drawer__go" href={directionsUrl(place)} target="_blank" rel="noreferrer">
                Get directions
              </a>
            </header>

            {(place.story || place.description) && (
              <blockquote className="drawer__story">
                {place.story && <p>{place.story}</p>}
                {place.description && <p className="muted">{place.description}</p>}
              </blockquote>
            )}

            <section className="drawer__block">
              <h3>{place.category === 'shop' ? 'What they sell' : 'Menu'}</h3>
              {place.dishes.length === 0 ? (
                <p className="muted">Nothing listed yet.</p>
              ) : (
                <ul className="menu">
                  {place.dishes.map((d) => (
                    <li key={d.id}>
                      <span className="menu__name">
                        {d.name}
                        {d.isVegetarian && (
                          <abbr className="veg" title="Vegetarian">
                            V
                          </abbr>
                        )}
                      </span>
                      <span className="menu__dots" aria-hidden="true" />
                      <span className="menu__price">{dollars(d.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="drawer__block">
              <h3>Reviews ({place.reviews.length})</h3>
              {place.reviews.length === 0 ? (
                <p className="muted">No reviews yet. Be the first.</p>
              ) : (
                <>
                  <dl className="scores">
                    {SCORES.map((s) => {
                      const avg = average(place.reviews, s.key);
                      return (
                        <div key={s.key}>
                          <dt>{s.label}</dt>
                          <dd>
                            <span className="bar">
                              <span style={{ width: `${(avg / 5) * 100}%` }} />
                            </span>
                            {avg.toFixed(1)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <ul className="reviews">
                    {place.reviews.map((r) => (
                      <li key={r.id}>
                        <strong>{r.authorName}</strong>
                        {r.comment && <p>{r.comment}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <ReviewForm placeId={place.id} defaultName={userName} onPosted={load} />
          </>
        )}
      </aside>
    </div>
  );
}
