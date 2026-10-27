import { useState } from 'react';
import { getMeetup, meetupAction } from '../api';
import { categoryById, directionsUrl, milesLabel, placeKind, splitSample } from '../categories';

const day = (d) => d.toLocaleDateString(undefined, { weekday: 'short' });
const date = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const time = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// One "ticket" for a food meetup: when, what, where, who's hosting and how many seats are left.
export default function MeetupCard({ meetup, token, onNeedSignIn, onChanged, onOpenPlace }) {
  const [mode, setMode] = useState(null); // null | 'join' | 'report'
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState(null);
  const [reason, setReason] = useState('');

  const when = new Date(meetup.startsAt);
  const cat = categoryById(meetup.place.category || 'eat');
  const kind = placeKind(meetup.place);
  const place = splitSample(meetup.place.name).name;
  const seats = Array.from({ length: meetup.maxPeople }, (_, i) => i < meetup.going);

  async function run(action, body) {
    if (!token) return onNeedSignIn();
    setBusy(true);
    setMessage('');
    try {
      await meetupAction(meetup.id, action, token, body);
      setMode(null);
      if (action === 'report') setMessage('Thanks. We hide meetups that get several reports.');
      onChanged();
    } catch (err) {
      if (err.status === 401) return onNeedSignIn();
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function showMembers() {
    try {
      const m = await getMeetup(meetup.id, token);
      setMembers(m.members);
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <article className="ticket" style={{ '--tone': cat.color }}>
      <div className="ticket__when" aria-label={`${when.toLocaleString()}`}>
        <span className="ticket__day">{day(when)}</span>
        <span className="ticket__date">{date(when)}</span>
        <span className="ticket__time">{time(when)}</span>
      </div>

      <div className="ticket__body">
        <p className="ticket__craving">
          <span aria-hidden="true">{kind.emoji}</span> {meetup.craving}
        </p>
        <p className="ticket__place">
          at{' '}
          <button className="linkish" onClick={() => onOpenPlace(meetup.place.id)}>
            {place}
          </button>
          {meetup.distanceKm != null && <span className="muted"> · {milesLabel(meetup.distanceKm)}</span>}
        </p>
        <p className="ticket__host muted">
          {meetup.isHost ? 'You’re hosting' : `Hosted by ${meetup.hostName}`}
        </p>
        {meetup.note && <p className="ticket__note">“{meetup.note}”</p>}

        <div className="ticket__seats" aria-label={`${meetup.going} of ${meetup.maxPeople} going`}>
          {seats.map((taken, i) => (
            <span key={i} className={`seat${taken ? ' seat--taken' : ''}`} aria-hidden="true" />
          ))}
          <span className="ticket__count">
            {meetup.spotsLeft === 0 ? 'Full' : `${meetup.spotsLeft} ${meetup.spotsLeft === 1 ? 'seat' : 'seats'} left`}
          </span>
        </div>

        {(meetup.joined || meetup.isHost) && (
          <div className="ticket__going">
            {members ? (
              <p>
                <strong>Who’s going:</strong> {members.join(', ')}
              </p>
            ) : (
              <button className="linkish" onClick={showMembers}>
                See who’s going
              </button>
            )}
            <a className="linkish" href={directionsUrl(meetup.place)} target="_blank" rel="noreferrer">
              Directions
            </a>
          </div>
        )}

        {mode === 'join' && (
          <div className="ticket__confirm">
            <p>
              I’m 18 or older, and I’ll meet the group <strong>inside {place}</strong> at the time above.
            </p>
            <div className="ticket__actions">
              <button className="btn btn--ink" disabled={busy} onClick={() => run('join', { adultConfirmed: true })}>
                {busy ? 'Joining…' : 'Count me in'}
              </button>
              <button className="btn btn--ghost" onClick={() => setMode(null)}>
                Back
              </button>
            </div>
          </div>
        )}

        {mode === 'report' && (
          <div className="ticket__confirm">
            <label className="field">
              <span>What’s wrong with this meetup?</span>
              <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="ticket__actions">
              <button className="btn btn--ink" disabled={busy || reason.trim().length < 5} onClick={() => run('report', { reason })}>
                Send report
              </button>
              <button className="btn btn--ghost" onClick={() => setMode(null)}>
                Back
              </button>
            </div>
          </div>
        )}

        {!mode && (
          <div className="ticket__actions">
            {meetup.isHost ? (
              <button className="btn btn--ghost" disabled={busy} onClick={() => run('cancel')}>
                Cancel meetup
              </button>
            ) : meetup.joined ? (
              <>
                <span className="ticket__in">✓ You’re going</span>
                <button className="btn btn--link" disabled={busy} onClick={() => run('leave')}>
                  Leave
                </button>
              </>
            ) : meetup.spotsLeft > 0 ? (
              <button className="btn btn--ink" onClick={() => (token ? setMode('join') : onNeedSignIn())}>
                Join this hunt
              </button>
            ) : null}
            {!meetup.isHost && (
              <button className="btn btn--link ticket__report" onClick={() => (token ? setMode('report') : onNeedSignIn())}>
                Report
              </button>
            )}
          </div>
        )}

        {message && (
          <p className="form-msg" role="status">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}
