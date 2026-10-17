import { cuisineColor, cuisineName, distanceLabel, groupByCuisine, priceLabel, splitSample, vendorName } from '../format';

function PlaceRow({ place, onOpen }) {
  const { name, isSample } = splitSample(place.name);
  return (
    <li>
      <button className="place" onClick={() => onOpen(place.id)}>
        <span className="place__line">
          <span className="place__name">{name}</span>
          <span className="place__leader" aria-hidden="true" />
          <span className="place__dist">{distanceLabel(place.distanceKm)}</span>
        </span>
        <span className="place__meta">
          <span className="tag">{vendorName(place.vendorType)}</span>
          <span className="tag" aria-label={`Price level ${place.priceLevel} of 4`}>
            {priceLabel(place.priceLevel)}
          </span>
          {place.avgAuthenticity != null && (
            <span className="tag tag--score">Authenticity {place.avgAuthenticity.toFixed(1)}/5</span>
          )}
          {isSample && <span className="tag tag--sample">Sample listing</span>}
        </span>
        {place.matchedDishes?.length > 0 && (
          <span className="place__dishes">
            Serves{' '}
            {place.matchedDishes.map((d, i) => (
              <span key={d}>
                <mark>{d}</mark>
                {i < place.matchedDishes.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

export default function MenuBoard({ places, onOpen }) {
  return (
    <div className="board">
      {groupByCuisine(places).map(({ cuisine, places: group }) => (
        <section key={cuisine} className="board__section" style={{ '--lamp': cuisineColor(cuisine) }}>
          <h3 className="board__heading">
            <span className="board__lamp" aria-hidden="true" />
            {cuisineName(cuisine)}
            <span className="board__count">
              {group.length} {group.length === 1 ? 'place' : 'places'}
            </span>
          </h3>
          <ul className="board__list">
            {group.map((p) => (
              <PlaceRow key={p.id} place={p} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
