// Turns what someone types ("i'm craving tocos") into search terms ("taco", "birria", ...).
//
// 1. Clean it up: lowercase, drop filler like "i'm craving", trim a plural "s".
// 2. Fix small typos against the craving list below ("tocos" -> "tacos").
// 3. Add related words, so "boba" also finds "milk tea" and "coffee" finds "cortado".
//
// Each term is matched with LIKE %term%, so "taco" already matches "Birria Tacos".

const CRAVINGS = {
  tacos: ['taco', 'birria', 'al pastor', 'barbacoa', 'carnitas', 'taqueria'],
  burrito: ['burrito'],
  quesadilla: ['quesadilla', 'quesabirria'],
  tamales: ['tamal'],
  mexican: ['mexican', 'taco', 'burrito', 'enchilada', 'tamal'],
  momo: ['momo', 'dumpling'],
  dumplings: ['dumpling', 'momo', 'gyoza', 'potsticker', 'bao'],
  pho: ['pho'],
  ramen: ['ramen'],
  noodles: ['noodle', 'pho', 'ramen', 'lo mein', 'pad thai', 'udon'],
  sushi: ['sushi', 'sashimi', 'roll'],
  curry: ['curry', 'masala', 'tikka', 'dal'],
  biryani: ['biryani'],
  'banh mi': ['banh mi'],
  sandwich: ['sandwich', 'banh mi', 'po boy'],
  bbq: ['bbq', 'barbecue', 'brisket', 'ribs', 'smoked'],
  burger: ['burger'],
  pizza: ['pizza'],
  wings: ['wing'],
  'fried chicken': ['fried chicken', 'chicken'],
  'soul food': ['soul', 'smothered', 'collard', 'cornbread'],
  crawfish: ['crawfish', 'etouffee', 'cajun'],
  seafood: ['crawfish', 'shrimp', 'catfish', 'fish', 'oyster', 'etouffee'],
  coffee: ['coffee', 'latte', 'espresso', 'cortado', 'cold brew', 'cappuccino', 'americano', 'roaster'],
  boba: ['boba', 'bubble tea', 'milk tea', 'tapioca'],
  tea: ['tea', 'chai'],
  smoothie: ['smoothie', 'juice'],
  kolache: ['kolache', 'klobasnik'],
  donut: ['donut', 'doughnut'],
  bakery: ['bakery', 'panaderia', 'bread', 'concha', 'pastry', 'croissant'],
  'pan dulce': ['concha', 'pan dulce', 'panaderia'],
  dessert: ['dessert', 'cake', 'churro', 'ice cream', 'tres leches', 'cookie'],
  'ice cream': ['ice cream', 'gelato', 'paleta'],
  churros: ['churro'],
  breakfast: ['breakfast', 'kolache', 'taco', 'biscuit', 'pancake'],
  groceries: ['grocery', 'market', 'rice', 'spice', 'masala'],
  vegetarian: ['veg', 'vegetarian', 'tofu', 'paneer', 'dal'],
};

// Leading words people type before the food itself: "i'm craving some", "want a", ...
const FILLER = /^(?:(?:i'?m|i am|im|i|so|really|craving|hungry|for|in|the|mood|want|wanna|looking|need|some|a|an)\s+)+/;

// Lowercase, strip punctuation and filler words, collapse spaces.
function clean(text = '') {
  const words = String(text).toLowerCase().replace(/’/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${words} `.replace(FILLER, '').trim();
}

// "tacos" -> "taco", "kolaches" -> "kolache", but leave "boba", "glass" alone.
function singular(word) {
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

// Find the craving someone meant, allowing 1 typo (2 for longer words).
function findCraving(text) {
  const keys = Object.keys(CRAVINGS);
  const exact = keys.find((k) => k === text || singular(k) === singular(text));
  if (exact) return { key: exact, corrected: false };
  if (text.length < 4) return null;
  const allowed = text.length >= 7 ? 2 : 1;
  let best = null;
  for (const k of keys) {
    const d = Math.min(editDistance(text, k), editDistance(singular(text), singular(k)));
    if (d <= allowed && (!best || d < best.d)) best = { key: k, d };
  }
  return best ? { key: best.key, corrected: true } : null;
}

/**
 * expandCraving("I'm craving tocos")
 *  -> { query: 'tacos', typed: 'tocos', corrected: true, terms: ['taco', 'birria', ...] }
 */
function expandCraving(raw) {
  const typed = clean(raw);
  if (!typed) return { query: '', typed: '', corrected: false, terms: [] };

  const hit = findCraving(typed);
  if (!hit) return { query: typed, typed, corrected: false, terms: [singular(typed)] };

  const terms = [...new Set([singular(hit.key), ...CRAVINGS[hit.key]])].slice(0, 10);
  return { query: hit.key, typed, corrected: hit.corrected, terms };
}

module.exports = { expandCraving, CRAVINGS, editDistance, clean, singular };
