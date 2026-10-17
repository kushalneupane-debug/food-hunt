// Display helpers shared by the components.

// The three cuisines shown as their own categories; everything else is "Other".
export const FEATURED_CUISINES = ['mexican', 'japanese', 'chinese'];

// One lantern color per cuisine (falls back to indigo).
const CUISINE_COLORS = {
  mexican: '#E2443B',
  japanese: '#D9467A',
  chinese: '#C9372C',
  nepali: '#F5B341',
  indian: '#E8892B',
  vietnamese: '#63C29A',
  thai: '#4FB3BF',
  korean: '#7A6FF0',
  ethiopian: '#B8862F',
  'middle-eastern': '#C7A23A',
  'soul-food': '#B0629A',
  cajun: '#D9772B',
  bbq: '#8C4A2F',
  other: '#6B6585',
};

const CUISINE_NAMES = {
  bbq: 'BBQ',
  'soul-food': 'Soul food',
  'middle-eastern': 'Middle Eastern',
};

const VENDOR_NAMES = {
  restaurant: 'Restaurant',
  'food-truck': 'Food truck',
  'pop-up': 'Pop-up',
  'market-stall': 'Market stall',
};

export const cuisineColor = (c) => CUISINE_COLORS[c] || '#231C47';

export function cuisineName(c = '') {
  if (CUISINE_NAMES[c]) return CUISINE_NAMES[c];
  return c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, ' ');
}

export const vendorName = (v) => VENDOR_NAMES[v] || v;

export const priceLabel = (level) => '$'.repeat(Math.max(1, Math.min(4, level || 1)));

// The API works in km; people in Texarkana think in miles.
export const KM_PER_MILE = 1.609344;

export function distanceLabel(km) {
  if (km == null) return '';
  const miles = km / KM_PER_MILE;
  if (miles < 0.1) return 'right here';
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export const dollars = (cents) => (cents == null ? '' : `$${(cents / 100).toFixed(2)}`);

// Seed data is labelled "Sample: …" so nobody mistakes it for a real business.
export function splitSample(name = '') {
  const isSample = name.startsWith('Sample: ');
  return { isSample, name: isSample ? name.slice(8) : name };
}

// Group results into menu sections: featured cuisines first, then the rest A–Z.
export function groupByCuisine(results) {
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r.cuisine)) groups.set(r.cuisine, []);
    groups.get(r.cuisine).push(r);
  }
  const rank = (c) => {
    const i = FEATURED_CUISINES.indexOf(c);
    return i === -1 ? FEATURED_CUISINES.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || cuisineName(a).localeCompare(cuisineName(b)))
    .map(([cuisine, places]) => ({ cuisine, places }));
}
