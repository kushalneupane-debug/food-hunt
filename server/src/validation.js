const { z } = require('zod');

const CUISINES = [
  'nepali', 'indian', 'mexican', 'vietnamese', 'chinese', 'thai', 'korean',
  'japanese', 'ethiopian', 'middle-eastern', 'soul-food', 'cajun', 'bbq', 'other',
];
const VENDOR_TYPES = ['restaurant', 'food-truck', 'pop-up', 'market-stall', 'cafe', 'bakery', 'store'];
// Top-level categories shown as tabs: places to eat, drink, get sweets, or shop for ingredients.
const CATEGORIES = ['eat', 'drink', 'sweets', 'shop'];
const subcategory = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, 'Use lowercase words joined by dashes');

// Query strings arrive as text, so coerce numbers.
const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(25),
  q: z.string().trim().max(80).default(''),
  cuisine: z.enum(CUISINES).optional(),
  category: z.enum(CATEGORIES).optional(),
});

const createBusiness = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  story: z.string().trim().max(2000).optional(),
  cuisine: z.enum(CUISINES),
  category: z.enum(CATEGORIES).default('eat'),
  subcategory: subcategory.optional(),
  vendorType: z.enum(VENDOR_TYPES),
  priceLevel: z.number().int().min(1).max(4),
  address: z.string().trim().min(5).max(255),
  isLicensed: z.literal(true, {
    errorMap: () => ({ message: 'Only licensed/permitted vendors can be listed' }),
  }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const rating = z.number().int().min(1).max(5);
const createReview = z.object({
  // Ignored when sent: the server uses the signed-in account's first name.
  authorName: z.string().trim().max(60).optional(),
  authenticity: rating,
  taste: rating,
  value: rating,
  comment: z.string().trim().max(1000).optional(),
});

const idParam = z.coerce.number().int().positive();

module.exports = { CUISINES, VENDOR_TYPES, CATEGORIES, searchQuery, createBusiness, createReview, idParam };


// Authentication validation.
const authZ = require('zod').z;

const authEmail = authZ.string()
  .trim()
  .email()
  .max(254)
  .toLowerCase();

const authPassword = authZ.string()
  .min(8, 'Password must contain at least 8 characters')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must not exceed 72 bytes'
  );

// Normalize formatting without guessing a country code. Store E.164-style +digits.
const authPhone = authZ.string().trim().max(40)
  .regex(/^\+[0-9 ()-]+$/)
  .transform(value => value.replace(/[ ()-]/g, ''))
  .pipe(authZ.string().regex(/^\+[1-9]\d{7,14}$/));

const contactSchema = (fields) => authZ.union([
  authZ.object({ email: authEmail, ...fields }).strict(),
  authZ.object({ phone: authPhone, ...fields }).strict(),
]);

module.exports.requestSignupCode = contactSchema({ name: authZ.string().trim().min(2).max(120) });
module.exports.verifySignupCode = contactSchema({ code: authZ.string().regex(/^\d{6}$/) });
module.exports.registerUser = contactSchema({
  password: authPassword,
  verificationToken: authZ.string().regex(/^[a-f0-9]{64}$/),
});
module.exports.loginUser = contactSchema({
  password: authZ.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must not exceed 72 bytes'),
});

// Hunt Together (food meetups).
const meetupZ = require('zod').z;
const DAY_MS = 24 * 60 * 60 * 1000;
module.exports.MEETUP_LIMITS = { minLeadMs: 30 * 60 * 1000, maxAheadMs: 30 * DAY_MS, minPeople: 2, maxPeople: 8 };

module.exports.meetupQuery = meetupZ.object({
  lat: meetupZ.coerce.number().min(-90).max(90),
  lng: meetupZ.coerce.number().min(-180).max(180),
  radiusKm: meetupZ.coerce.number().positive().max(100).default(40),
});

module.exports.createMeetup = meetupZ.object({
  businessId: meetupZ.number().int().positive(),
  craving: meetupZ.string().trim().min(2).max(40),
  note: meetupZ.string().trim().max(280).optional(),
  startsAt: meetupZ.string().datetime({ offset: true }),
  maxPeople: meetupZ.number().int().min(2).max(8),
  // People meet strangers here, so hosts confirm they're adults and agree to the safety rules.
  adultConfirmed: meetupZ.literal(true, { errorMap: () => ({ message: 'Confirm you are 18 or older' }) }),
}).strict();

module.exports.reportMeetup = meetupZ.object({
  reason: meetupZ.string().trim().min(5).max(500),
}).strict();

module.exports.joinMeetup = meetupZ.object({
  adultConfirmed: meetupZ.literal(true, { errorMap: () => ({ message: 'Confirm you are 18 or older' }) }),
}).strict();
