import { categoryById, milesLabel, placeKind, priceLabel, splitSample, vendorLabel } from '../categories';

export default function PlaceCard({ place, onOpen, highlighted, picked }) {
  const cat = categoryById(place.category || 'eat');
  const kind = placeKind(place);
  const { name, isSample } = splitSample(place.name);

  return (
    <article
      id={`place-${place.id}`}
      className={`card${highlighted ? ' card--lit' : ''}${picked ? ' card--picked' : ''}`}
      style={{ '--tone': cat.color }}
    >
      <button className="card__hit" onClick={() => onOpen(place.id)}>
        <div className="card__band">
          <span className="card__emoji" aria-hidden="true">
            {kind.emoji}
          </span>
          <span className="card__kind">{kind.label}</span>
          {picked && <span className="card__pick">Tonight's pick</span>}
        </div>

        <div className="card__body">
          <h3>{name}</h3>
          <p className="card__meta">
            <span>{vendorLabel(place.vendorType)}</span>
            <span aria-label={`Price level ${place.priceLevel} of 4`}>{priceLabel(place.priceLevel)}</span>
            {place.avgAuthenticity != null && <span>★ {Number(place.avgAuthenticity).toFixed(1)}</span>}
            {isSample && <span className="tag-sample">Sample</span>}
          </p>
          {place.matchedDishes?.length > 0 && (
            <p className="card__dishes">
              Has{' '}
              {place.matchedDishes.map((d, i) => (
                <span key={d}>
                  <mark>{d}</mark>
                  {i < place.matchedDishes.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          )}
          <p className="card__foot">
            <span className="card__dist">{milesLabel(place.distanceKm)}</span>
            <span className="card__more">Menu &amp; reviews</span>
          </p>
        </div>
      </button>
    </article>
  );
}
