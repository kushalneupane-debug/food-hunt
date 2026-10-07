// In-memory stand-in for the MySQL repository, used by unit tests.
function createFakeRepo({ failPing = false } = {}) {
  const businesses = [
    {
      id: 1, name: 'Sample: Himalayan Momo House', cuisine: 'nepali', vendorType: 'restaurant',
      priceLevel: 2, address: '100 Sample St', lat: 33.4251, lng: -94.0477, distanceKm: 0.5,
      dishes: [{ id: 1, name: 'Chicken Momo' }], reviews: [],
    },
  ];
  const reviews = [];
  const calls = [];

  return {
    calls,
    reviews,
    async ping() {
      if (failPing) throw new Error('db down');
      return true;
    },
    async searchNearby(params) {
      calls.push({ fn: 'searchNearby', params });
      const q = params.q.toLowerCase();
      return businesses
        .filter((b) => !params.cuisine || b.cuisine === params.cuisine)
        .filter((b) => !q || b.name.toLowerCase().includes(q)
          || b.dishes.some((d) => d.name.toLowerCase().includes(q)))
        .map(({ dishes, reviews: _r, ...rest }) => ({
          ...rest,
          matchedDishes: q ? dishes.filter((d) => d.name.toLowerCase().includes(q)).map((d) => d.name) : [],
        }));
    },
    async getBusinessById(id) {
      return businesses.find((b) => b.id === id) || null;
    },
    async createBusiness(b) {
      const id = businesses.length + 1;
      businesses.push({ id, ...b, dishes: [], reviews: [] });
      return id;
    },
    async businessExists(id) {
      return businesses.some((b) => b.id === id);
    },
    async createReview(businessId, r) {
      reviews.push({ businessId, ...r });
      return reviews.length;
    },
  };
}

module.exports = { createFakeRepo };
