import { useEffect, useState } from 'react';
import { listMeetups } from '../api';
import MeetupCard from './MeetupCard';

const SAFETY = [
  ['🍽️', 'Always at a restaurant', 'Hunts happen only at public places listed on Food Hunt.'],
  ['✅', 'Verified people', 'Everyone signs up with a confirmed email or phone, and must be 18+.'],
  ['🙈', 'First names only', 'No one sees your email, phone, or last name.'],
  ['🚩', 'Report anything', 'Meetups that get reported are hidden.'],
];

// "Don't eat alone": upcoming food meetups nearby that anyone can join.
export default function HuntTogether({ where, token, refreshKey, onStart, onNeedSignIn, onOpenPlace }) {
  const [state, setState] = useState({ loading: true, error: '', meetups: [] });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    listMeetups({ lat: where.lat, lng: where.lng, token })
      .then((data) => active && setState({ loading: false, error: '', meetups: data.meetups }))
      .catch((err) => active && setState({ loading: false, error: err.message, meetups: [] }));
    return () => {
      active = false;
    };
  }, [where, token, refreshKey, tick]);

  const refresh = () => setTick((t) => t + 1);

  return (
    <section className="together" id="together" aria-labelledby="together-title">
      <div className="together__inner">
        <header className="together__head">
          <div>
            <p className="together__eyebrow">Hunt together</p>
            <h2 id="together-title">Don’t eat alone.</h2>
            <p className="together__lede">
              New in town, or just want company? Join neighbors who are craving the same thing, or start your own hunt
              and see who shows up.
            </p>
          </div>
          <button className="btn btn--sun" onClick={() => (token ? onStart() : onNeedSignIn())}>
            + Start a hunt
          </button>
        </header>

        {state.loading && <p className="together__msg">Looking for hunts nearby…</p>}
        {state.error && <p className="together__msg">Couldn’t load hunts: {state.error}</p>}

        {!state.loading && !state.error && state.meetups.length === 0 && (
          <div className="together__empty">
            <p>
              <strong>No hunts planned yet.</strong> Be the first: pick a place you’ve been wanting to try and a time.
            </p>
          </div>
        )}

        {state.meetups.length > 0 && (
          <div className="tickets">
            {state.meetups.map((m) => (
              <MeetupCard
                key={m.id}
                meetup={m}
                token={token}
                onNeedSignIn={onNeedSignIn}
                onChanged={refresh}
                onOpenPlace={onOpenPlace}
              />
            ))}
          </div>
        )}

        <ul className="safety" aria-label="How we keep hunts safe">
          {SAFETY.map(([icon, title, text]) => (
            <li key={title}>
              <span aria-hidden="true">{icon}</span>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
