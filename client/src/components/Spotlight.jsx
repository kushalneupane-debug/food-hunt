import { categoryById, directionsUrl, milesLabel, minutesAway, placeKind, ratingLabel, splitSample } from '../categories';

// The answer to "I'm craving tacos": the closest place that has them, plus the best-rated one nearby.
export default function Spotlight({ craving, nearest, topRated, onOpen, onFocus }) {
  const cat = categoryById(nearest.category || 'eat');
  const { name } = splitSample(nearest.name);
  const showTop = topRated && topRated.id !== nearest.id;

  return (
    <section className="spot" style={{ '--tone': cat.color }} aria-labelledby="spot-title">
      <p className="spot__stamp">Closest {craving}</p>
      <div className="spot__main">
        <span className="spot__emoji" aria-hidden="true">
          {placeKind(nearest).emoji}
        </span>
        <div>
          <h2 id="spot-title">{name}</h2>
          {!nearest.matchedDishes?.length && (
            <p className="spot__dishes">
              {placeKind(nearest).label} spot. Menu not added yet, so call ahead to check.
            </p>
          )}
          {nearest.matchedDishes?.length > 0 && (
            <p className="spot__dishes">
              Order the{' '}
              {nearest.matchedDishes.slice(0, 3).map((d, i, all) => (
                <span key={d}>
                  <mark>{d}</mark>
                  {i < all.length - 1 ? (i === all.length - 2 ? ' or ' : ', ') : ''}
                </span>
              ))}
            </p>
          )}
          <p className="spot__facts">
            <strong>{milesLabel(nearest.distanceKm)}</strong>
            <span>{minutesAway(nearest.distanceKm)}</span>
            <span>{ratingLabel(nearest)}</span>
          </p>
          <p className="spot__addr">{nearest.address}</p>
        </div>
      </div>
      <div className="spot__actions">
        <a className="btn btn--ink" href={directionsUrl(nearest)} target="_blank" rel="noreferrer">
          Take me there
        </a>
        <button className="btn btn--ghost" onClick={() => onOpen(nearest.id)}>
          Menu &amp; reviews
        </button>
      </div>
      {showTop && (
        <button className="spot__alt" onClick={() => onFocus(topRated.id)}>
          <span>Willing to drive a bit?</span> {splitSample(topRated.name).name} is the best rated,{' '}
          {milesLabel(topRated.distanceKm)} away ({ratingLabel(topRated)}).
        </button>
      )}
    </section>
  );
}
