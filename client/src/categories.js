// Category config and small display helpers shared by the components.

export const CATEGORIES = [
  { id: 'eat', label: 'Eat', emoji: '🍜', color: '#E4572E', blurb: 'Kitchens, trucks & pop-ups' },
  { id: 'drink', label: 'Sip', emoji: '☕', color: '#168A86', blurb: 'Coffee, boba & juice' },
  { id: 'sweets', label: 'Sweets', emoji: '🍩', color: '#E0679A', blurb: 'Bakeries & desserts' },
  { id: 'shop', label: 'Shop', emoji: '🛒', color: '#E3A21A', blurb: 'Groceries & markets' },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

const SUBCATEGORY_INFO = {
  coffee: { label: 'Coffee', emoji: '☕' },
  'boba-tea': { label: 'Boba & tea', emoji: '🧋' },
  juice: { label: 'Juice & smoothies', emoji: '🥤' },
  bakery: { label: 'Bakery', emoji: '🥐' },
  kolaches: { label: 'Kolaches', emoji: '🥯' },
  desserts: { label: 'Desserts', emoji: '🍨' },
  grocery: { label: 'Grocery', emoji: '🛒' },
  'farmers-market': { label: 'Farmers market', emoji: '🧺' },
};

const CUISINE_INFO = {
  nepali: { label: 'Nepali', emoji: '🥟' },
  indian: { label: 'Indian', emoji: '🍛' },
  mexican: { label: 'Mexican', emoji: '🌮' },
  vietnamese: { label: 'Vietnamese', emoji: '🍜' },
  chinese: { label: 'Chinese', emoji: '🥡' },
  japanese: { label: 'Japanese', emoji: '🍣' },
  korean: { label: 'Korean', emoji: '🍲' },
  thai: { label: 'Thai', emoji: '🍤' },
  ethiopian: { label: 'Ethiopian', emoji: '🫓' },
  'middle-eastern': { label: 'Middle Eastern', emoji: '🧆' },
  'soul-food': { label: 'Soul food', emoji: '🍗' },
  cajun: { label: 'Cajun', emoji: '🦐' },
  bbq: { label: 'BBQ', emoji: '🍖' },
  other: { label: 'Other', emoji: '🍽️' },
};

const titleCase = (s = '') => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const cuisineInfo = (c) => CUISINE_INFO[c] || { label: titleCase(c), emoji: '🍽️' };
export const subcategoryInfo = (s) => SUBCATEGORY_INFO[s] || { label: titleCase(s), emoji: '✨' };

// What a place "is", in one short label: subcategory for drink/sweets/shop, cuisine for food.
export function placeKind(place) {
  if (place.category && place.category !== 'eat' && place.subcategory) return subcategoryInfo(place.subcategory);
  return cuisineInfo(place.cuisine);
}

// The chip filter inside a category: cuisines for Eat, subcategories for the rest.
export function chipKey(place) {
  return place.category && place.category !== 'eat' && place.subcategory ? place.subcategory : place.cuisine;
}

export function chipInfo(categoryId, key) {
  return categoryId === 'eat' ? cuisineInfo(key) : subcategoryInfo(key);
}

const VENDOR = {
  restaurant: 'Restaurant',
  'food-truck': 'Food truck',
  'pop-up': 'Pop-up',
  'market-stall': 'Market stall',
  cafe: 'Café',
  bakery: 'Bakery',
  store: 'Store',
};
export const vendorLabel = (v) => VENDOR[v] || titleCase(v);

export const priceLabel = (n) => '$'.repeat(Math.max(1, Math.min(4, n || 1)));

const KM_PER_MILE = 1.609344;
export function milesLabel(km) {
  if (km == null) return '';
  const mi = km / KM_PER_MILE;
  if (mi < 0.1) return 'right here';
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

export const dollars = (cents) => (cents == null ? '' : `$${(cents / 100).toFixed(2)}`);

// Seed data is labelled "Sample: …" so nobody mistakes it for a real business.
export function splitSample(name = '') {
  const isSample = name.startsWith('Sample: ');
  return { isSample, name: isSample ? name.slice(8) : name };
}

// Opens turn-by-turn directions in Google Maps (app on phones, website elsewhere).
export const directionsUrl = (place) =>
  `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

// Rough drive time for the spotlight: ~30 mph average around town, at least 1 minute.
export function minutesAway(km) {
  if (km == null) return '';
  const min = Math.max(1, Math.round((km / 1.609344 / 30) * 60));
  return `about ${min} min drive`;
}

export const ratingLabel = (place) =>
  place.avgRating != null ? `★ ${Number(place.avgRating).toFixed(1)} (${place.reviewCount})` : 'No reviews yet';
