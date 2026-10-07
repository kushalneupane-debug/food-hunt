const { z } = require('zod');

const CUISINES = [
  'nepali', 'indian', 'mexican', 'vietnamese', 'chinese', 'thai', 'korean',
  'japanese', 'ethiopian', 'middle-eastern', 'soul-food', 'cajun', 'bbq', 'other',
];
const VENDOR_TYPES = ['restaurant', 'food-truck', 'pop-up', 'market-stall'];

// Query strings arrive as text, so coerce numbers.
const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(25),
  q: z.string().trim().max(80).default(''),
  cuisine: z.enum(CUISINES).optional(),
});

const createBusiness = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  story: z.string().trim().max(2000).optional(),
  cuisine: z.enum(CUISINES),
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
  authorName: z.string().trim().min(1).max(60),
  authenticity: rating,
  taste: rating,
  value: rating,
  comment: z.string().trim().max(1000).optional(),
});

const idParam = z.coerce.number().int().positive();

module.exports = { CUISINES, VENDOR_TYPES, searchQuery, createBusiness, createReview, idParam };
