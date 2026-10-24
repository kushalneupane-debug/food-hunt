// Converts OpenStreetMap (OSM) map data into Food Hunt places.
//
// OSM is a free, community-made map. Its data is licensed under the ODbL, which lets
// us use it as long as we credit "© OpenStreetMap contributors" (shown on the map and
// in the footer). OSM has names, locations, addresses and cuisine, but no menus:
// dishes come from our own list (dishes-texarkana.csv) or from owners.

// Area searched: Texarkana TX/AR plus Nash and Wake Village (south, west, north, east).
const TEXARKANA_BBOX = [33.33, -94.2, 33.53, -93.9];

function overpassQuery([s, w, n, e] = TEXARKANA_BBOX) {
  const box = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:60];(
    nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|food_court)$"]["name"]${box};
    nwr["shop"~"^(bakery|pastry|confectionery|greengrocer|deli|butcher|supermarket|farm)$"]["name"]${box};
    nwr["amenity"="marketplace"]["name"]${box};
  );out center tags;`;
}

// Food Hunt is about local places. OSM marks most chains with a "brand" tag; these are
// chains (or chain stores) in the area that are not tagged that way.
const CHAIN_NAMES = [
  'el chico', 'taco tico', "newk's eatery", "walk-on's", 'jaggers', 'dirty dough', 'cash saver',
  "flowers' discount bakery", 'lost pizza', 'catfish king',
];

// What we list. Gas stations and convenience stores are left out on purpose.
const FOOD_KINDS = new Set([
  'restaurant', 'fast_food', 'cafe', 'ice_cream', 'food_court',
  'bakery', 'pastry', 'confectionery', 'greengrocer', 'deli', 'butcher', 'supermarket', 'farm', 'marketplace',
]);
const GAS_STATION = /\b(fuel|truck stop|travel center|quick stop|quick mart|mart|valero)\b/i;

const isChain = (tags) =>
  Boolean(tags.brand || tags['brand:wikidata']) ||
  CHAIN_NAMES.some((c) => tags.name.toLowerCase().startsWith(c));

// OSM cuisine values -> our cuisine list (server/src/validation.js CUISINES).
const CUISINE_MAP = {
  mexican: 'mexican', 'tex-mex': 'mexican', tacos: 'mexican', latin_american: 'mexican',
  japanese: 'japanese', sushi: 'japanese', ramen: 'japanese', hibachi: 'japanese',
  chinese: 'chinese', korean: 'korean', thai: 'thai', vietnamese: 'vietnamese',
  indian: 'indian', nepali: 'nepali', ethiopian: 'ethiopian',
  lebanese: 'middle-eastern', greek: 'middle-eastern', mediterranean: 'middle-eastern', middle_eastern: 'middle-eastern',
  barbecue: 'bbq', bbq: 'bbq', cajun: 'cajun', creole: 'cajun', soul_food: 'soul-food',
};

// When OSM has no cuisine, the name often gives it away ("Tacos 4 Life", "Big Jake's BBQ").
const NAME_HINTS = [
  [/taco|taquer|mexican|cantina|mercado|latino|guanajuato/, { cuisine: 'mexican' }],
  [/sushi|hibachi|ramen|bento|japanese/, { cuisine: 'japanese' }],
  [/bbq|barbecue|smokehouse/, { cuisine: 'bbq' }],
  [/chinese|wok/, { cuisine: 'chinese' }],
  [/\bpho\b|viet/, { cuisine: 'vietnamese' }],
  [/india|curry/, { cuisine: 'indian' }],
  [/crawfish|cajun|bayou/, { cuisine: 'cajun' }],
  [/donut|doughnut/, { subcategory: 'donuts' }],
  [/wing/, { subcategory: 'wings' }],
  [/burger/, { subcategory: 'burger' }],
  [/pizza/, { subcategory: 'pizza' }],
  [/seafood|catfish|fish|crab/, { subcategory: 'seafood' }],
  [/salad/, { subcategory: 'salads' }],
  [/coffee|espresso/, { subcategory: 'coffee' }],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function nameHints(name) {
  const lower = name.toLowerCase();
  const out = {};
  for (const [re, hint] of NAME_HINTS) {
    if (re.test(lower)) {
      if (hint.cuisine && !out.cuisine) out.cuisine = hint.cuisine;
      if (hint.subcategory && !out.subcategory) out.subcategory = hint.subcategory;
    }
  }
  return out;
}

// State Line Avenue (about -94.0427) splits Texarkana TX from Texarkana AR.
const stateFor = (tags, lng) => tags['addr:state'] || (lng < -94.0427 ? 'TX' : 'AR');

function addressFor(tags, lng) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'] || 'Texarkana';
  return [street, `${city}, ${stateFor(tags, lng)}`].filter(Boolean).join(', ');
}

/**
 * One OSM element -> a Food Hunt place, or null when it should be skipped
 * (no name, a chain, or no location).
 */
function toPlace(el) {
  const tags = el.tags || {};
  if (!tags.name) return null;
  if (isChain(tags)) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const kind = tags.amenity || tags.shop;
  if (!FOOD_KINDS.has(kind) || tags.shop === 'convenience' || tags.amenity === 'fuel' || GAS_STATION.test(tags.name)) {
    return null;
  }
  const osmCuisines = (tags.cuisine || '').split(';').map((c) => c.trim().toLowerCase()).filter(Boolean);
  const hints = nameHints(tags.name);
  const mapped = osmCuisines.map((c) => CUISINE_MAP[c]).find(Boolean);
  // A specific style ("burger", "donut", "coffee_shop") we don't have a cuisine for.
  const style = osmCuisines.find((c) => !CUISINE_MAP[c] && !['american', 'regional', 'local'].includes(c));

  let category = 'eat';
  let vendorType = 'restaurant';
  let subcategory = hints.subcategory || (style ? slug(style.replace(/_shop$/, '')) : null);

  if (kind === 'cafe' || osmCuisines.includes('coffee_shop')) {
    category = 'drink';
    vendorType = 'cafe';
    subcategory = 'coffee';
  }
  if (osmCuisines.includes('donut') || hints.subcategory === 'donuts') {
    category = 'sweets';
    subcategory = 'donuts';
  }
  if (kind === 'ice_cream') {
    category = 'sweets';
    vendorType = 'store';
    subcategory = 'desserts';
  }
  if (['bakery', 'pastry', 'confectionery'].includes(kind)) {
    category = 'sweets';
    vendorType = 'bakery';
    subcategory = 'bakery';
  }
  if (['greengrocer', 'deli', 'butcher', 'supermarket', 'farm'].includes(kind)) {
    category = 'shop';
    vendorType = 'store';
    subcategory = kind === 'butcher' ? 'butcher' : 'grocery';
  }
  if (kind === 'marketplace') {
    category = 'shop';
    vendorType = 'market-stall';
    subcategory = 'farmers-market';
  }
  if (subcategory === 'donut') subcategory = 'donuts';

  return {
    osmId: `${el.type}/${el.id}`,
    name: tags.name.trim().slice(0, 120),
    cuisine: mapped || hints.cuisine || 'other',
    category,
    subcategory: subcategory && /^[a-z0-9-]{2,40}$/.test(subcategory) ? subcategory : null,
    vendorType,
    priceLevel: kind === 'fast_food' ? 1 : 2,
    address: addressFor(tags, lng).slice(0, 255),
    lat: Number(Number(lat).toFixed(6)),
    lng: Number(Number(lng).toFixed(6)),
    website: tags.website || tags['contact:website'] || null,
    phone: tags.phone || tags['contact:phone'] || null,
    openingHours: tags.opening_hours || null,
  };
}

function toPlaces(overpassJson) {
  const seen = new Set();
  const places = [];
  for (const el of overpassJson.elements || []) {
    const p = toPlace(el);
    if (!p || seen.has(p.osmId)) continue;
    seen.add(p.osmId);
    places.push(p);
  }
  return places.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { overpassQuery, toPlace, toPlaces, isChain, nameHints, TEXARKANA_BBOX, CHAIN_NAMES };
