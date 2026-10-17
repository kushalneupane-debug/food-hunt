import { FEATURED_CUISINES, cuisineColor, cuisineName } from '../format';

// All | Mexican | Japanese | Chinese | Other cuisines
// "Other" shows a second row with every remaining cuisine found nearby.
export default function CategoryTabs({ category, onCategoryChange, otherCuisine, onOtherCuisineChange, counts }) {
  const tabs = [
    { id: 'all', label: 'All' },
    ...FEATURED_CUISINES.map((c) => ({ id: c, label: cuisineName(c), color: cuisineColor(c) })),
    { id: 'other', label: 'Other cuisines' },
  ];
  const otherCuisines = Object.keys(counts.byCuisine)
    .filter((c) => !FEATURED_CUISINES.includes(c))
    .sort((a, b) => cuisineName(a).localeCompare(cuisineName(b)));

  return (
    <nav className="tabs" aria-label="Cuisine">
      <div className="tabs__row" role="tablist">
        {tabs.map((t) => {
          const n = t.id === 'all' ? counts.all : t.id === 'other' ? counts.other : counts.byCuisine[t.id] || 0;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={category === t.id}
              className={`tab${n === 0 ? ' tab--empty' : ''}`}
              onClick={() => onCategoryChange(t.id)}
            >
              {t.color && <span className="tab__lamp" style={{ background: t.color }} aria-hidden="true" />}
              {t.label}
              <span className="tab__count">{n}</span>
            </button>
          );
        })}
      </div>

      {category === 'other' && otherCuisines.length > 0 && (
        <div className="tabs__sub">
          <button
            className="chip"
            aria-pressed={otherCuisine === null}
            onClick={() => onOtherCuisineChange(null)}
          >
            Every other cuisine
          </button>
          {otherCuisines.map((c) => (
            <button
              key={c}
              className="chip"
              aria-pressed={otherCuisine === c}
              onClick={() => onOtherCuisineChange(c)}
            >
              <span className="tab__lamp" style={{ background: cuisineColor(c) }} aria-hidden="true" />
              {cuisineName(c)} <span className="tab__count">{counts.byCuisine[c]}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
