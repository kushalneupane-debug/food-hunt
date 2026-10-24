// Real places from OpenStreetMap: conversion rules and the dishes CSV reader.
const { toPlace, toPlaces, isChain, overpassQuery } = require('../../db/osm-places');
const { parseCsv, toCents, describe: describePlace } = require('../../db/import-places');
const PLACES = require('../../db/places-texarkana.json');
const { CUISINES, CATEGORIES, VENDOR_TYPES } = require('../../src/validation');

const node = (tags, extra = {}) => ({ type: 'node', id: 1, lat: 33.44, lon: -94.07, tags, ...extra });

describe('OpenStreetMap -> Food Hunt place', () => {
  test('TC-51 maps a Mexican restaurant to Eat / mexican with a Texas address', () => {
    const p = toPlace(node({
      amenity: 'restaurant', name: 'Test Taqueria', cuisine: 'mexican',
      'addr:housenumber': '12', 'addr:street': 'Main Street', 'addr:city': 'Texarkana',
    }));
    expect(p).toMatchObject({
      osmId: 'node/1', category: 'eat', cuisine: 'mexican', vendorType: 'restaurant',
      address: '12 Main Street, Texarkana, TX',
    });
  });

  test('TC-52 uses the building centre for ways and the Arkansas side east of State Line', () => {
    const p = toPlace({ type: 'way', id: 9, center: { lat: 33.45, lon: -94.03 }, tags: { amenity: 'cafe', name: 'Bean There' } });
    expect(p).toMatchObject({ osmId: 'way/9', lat: 33.45, category: 'drink', subcategory: 'coffee', vendorType: 'cafe' });
    expect(p.address).toBe('Texarkana, AR');
  });

  test('TC-53 guesses cuisine and type from the name when OSM has none', () => {
    expect(toPlace(node({ amenity: 'fast_food', name: 'Tacos Mi Pueblo' }))).toMatchObject({ cuisine: 'mexican', priceLevel: 1 });
    expect(toPlace(node({ amenity: 'restaurant', name: "Big Jake's BBQ" })).cuisine).toBe('bbq');
    expect(toPlace(node({ amenity: 'fast_food', name: 'Mix Donuts' }))).toMatchObject({ category: 'sweets', subcategory: 'donuts' });
  });

  test('TC-54 sorts bakeries into Sweets and grocers into Shop', () => {
    expect(toPlace(node({ shop: 'bakery', name: 'Sweet Arts Cakery' }))).toMatchObject({ category: 'sweets', vendorType: 'bakery' });
    expect(toPlace(node({ shop: 'greengrocer', name: 'Fruteria El Nacimento' }))).toMatchObject({ category: 'shop', subcategory: 'grocery' });
  });

  test('TC-55 leaves out chains, gas stations, convenience stores and unnamed places', () => {
    expect(isChain({ name: 'McDonald\'s', brand: "McDonald's" })).toBe(true);
    expect(toPlace(node({ amenity: 'restaurant', name: 'El Chico' }))).toBeNull();
    expect(toPlace(node({ shop: 'convenience', name: 'Corner Store' }))).toBeNull();
    expect(toPlace(node({ amenity: 'fast_food', name: 'Fuel N Go' }))).toBeNull();
    expect(toPlace(node({ amenity: 'restaurant' }))).toBeNull();
  });

  test('TC-56 removes duplicates by OSM id', () => {
    const el = node({ amenity: 'restaurant', name: 'Twice' });
    expect(toPlaces({ elements: [el, el] })).toHaveLength(1);
  });

  test('TC-57 the Overpass query covers restaurants, cafes, bakeries and markets', () => {
    const q = overpassQuery();
    for (const word of ['restaurant', 'fast_food', 'cafe', 'bakery', 'marketplace']) expect(q).toContain(word);
    expect(q).not.toContain('convenience');
  });
});

describe('saved Texarkana data file', () => {
  test('TC-58 every saved place passes our validation rules', () => {
    expect(PLACES.license).toMatch(/OpenStreetMap contributors/);
    expect(PLACES.places.length).toBeGreaterThan(40);
    for (const p of PLACES.places) {
      expect(CUISINES).toContain(p.cuisine);
      expect(CATEGORIES).toContain(p.category);
      expect(VENDOR_TYPES).toContain(p.vendorType);
      expect(p.name).not.toMatch(/^Sample:/);
      expect(p.lat).toBeGreaterThan(33.3);
      expect(p.lat).toBeLessThan(33.6);
    }
  });
});

describe('dishes CSV', () => {
  test('TC-59 reads quoted values and skips # comment lines', () => {
    const rows = parseCsv('# note\nplace,dish,price,vegetarian\n"Taco Trip","Tacos, al pastor",8.50,no\n\n');
    expect(rows).toEqual([{ place: 'Taco Trip', dish: 'Tacos, al pastor', price: '8.50', vegetarian: 'no' }]);
  });

  test('TC-60 converts prices to cents and leaves blanks empty', () => {
    expect(toCents('$8.50')).toBe(850);
    expect(toCents('')).toBeNull();
    expect(toCents('abc')).toBeNull();
  });

  test('TC-61 descriptions say where the listing came from', () => {
    expect(describePlace({ openingHours: 'Mo-Fr 11:00-21:00' })).toMatch(/^Hours: Mo-Fr 11:00-21:00\..*OpenStreetMap/);
  });
});
