import { useEffect, useRef, useState } from 'react';
import { createMeetup } from '../api';
import { splitSample } from '../categories';

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Default: today at 6:30 PM, or tomorrow if that time has (nearly) passed.
function defaultWhen() {
  const d = new Date();
  if (d.getHours() >= 17) d.setDate(d.getDate() + 1);
  const max = new Date();
  max.setDate(max.getDate() + 30);
  return { date: localDate(d), min: localDate(new Date()), max: localDate(max), time: '18:30' };
}

export default function StartHuntDialog({ places, initialPlaceId, initialCraving, token, onClose, onCreated }) {
  const when = defaultWhen();
  const [form, setForm] = useState({
    businessId: initialPlaceId || places[0]?.id || '',
    craving: initialCraving || '',
    date: when.date,
    time: when.time,
    maxPeople: 4,
    note: '',
    adultConfirmed: false,
  });
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const firstRef = useRef(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.time}`);
    if (!form.businessId || form.craving.trim().length < 2 || Number.isNaN(start.getTime())) {
      setStatus({ state: 'error', message: 'Pick a place, what you’re craving, and a time.' });
      return;
    }
    if (!form.adultConfirmed) {
      setStatus({ state: 'error', message: 'Please confirm you’re 18 or older and agree to the safety rules.' });
      return;
    }
    setStatus({ state: 'saving', message: '' });
    try {
      await createMeetup(
        {
          businessId: Number(form.businessId),
          craving: form.craving.trim(),
          startsAt: start.toISOString(),
          maxPeople: Number(form.maxPeople),
          adultConfirmed: true,
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
        token
      );
      onCreated();
    } catch (err) {
      setStatus({ state: 'error', message: err.message });
    }
  }

  return (
    <div className="backdrop backdrop--center" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hunt-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <p className="dialog__eyebrow">Hunt together</p>
        <h2 id="hunt-title">Start a food hunt</h2>
        <p className="muted">Pick a place and a time. People nearby who are craving the same thing can join you.</p>

        {places.length === 0 ? (
          <p className="form-msg form-msg--error">Search for a place first, then start a hunt there.</p>
        ) : (
          <label className="field">
            <span>Where</span>
            <select ref={firstRef} value={form.businessId} onChange={(e) => set('businessId', e.target.value)}>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {splitSample(p.name).name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Craving</span>
          <input value={form.craving} maxLength={40} placeholder="tacos, sushi, boba…" onChange={(e) => set('craving', e.target.value)} />
        </label>

        <div className="dialog__row">
          <label className="field">
            <span>Day</span>
            <input type="date" value={form.date} min={when.min} max={when.max} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className="field">
            <span>Time</span>
            <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </label>
          <label className="field">
            <span>Group size</span>
            <select value={form.maxPeople} onChange={(e) => set('maxPeople', e.target.value)}>
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} people
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Note for the group (optional)</span>
          <textarea
            rows={2}
            maxLength={280}
            placeholder="First time trying birria! I’ll grab a table by the window."
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </label>

        <label className="check">
          <input type="checkbox" checked={form.adultConfirmed} onChange={(e) => set('adultConfirmed', e.target.checked)} />
          <span>
            I’m 18 or older. I’ll meet only inside this restaurant, and I won’t ask anyone for their address or a ride.
          </span>
        </label>

        {status.message && (
          <p className={`form-msg form-msg--${status.state}`} role="status">
            {status.message}
          </p>
        )}

        <div className="dialog__actions">
          <button className="btn btn--ink" type="submit" disabled={status.state === 'saving' || places.length === 0}>
            {status.state === 'saving' ? 'Posting…' : 'Post my hunt'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
