// Data-access layer. All SQL lives here so routes stay testable with a fake repo.
//
// Coordinates: columns use SRID 4326 (WGS 84). MySQL treats 4326 as lat-long axis
// order by default, so every WKT we build passes 'axis-order=long-lat' explicitly
// and we always write POINT(lng lat).

const pointWkt = (lat, lng) => `POINT(${Number(lng)} ${Number(lat)})`;

function createRepository(pool) {
  return {
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },

    /**
     * Dish-first nearby search.
     * q matches a business name OR any dish name on its menu.
     */
    async searchNearby({ lat, lng, radiusKm = 25, q = '', cuisine = null, limit = 50 }) {
      const like = `%${q}%`;
      const origin = pointWkt(lat, lng);
      const [rows] = await pool.query(
        `SELECT b.id, b.name, b.cuisine, b.vendor_type AS vendorType,
                b.price_level AS priceLevel, b.address,
                ST_Latitude(b.location)  AS lat,
                ST_Longitude(b.location) AS lng,
                ROUND(ST_Distance_Sphere(b.location,
                      ST_GeomFromText(?, 4326, 'axis-order=long-lat')) / 1000, 2) AS distanceKm,
                (SELECT GROUP_CONCAT(d.name ORDER BY d.name SEPARATOR ', ')
                   FROM dishes d
                  WHERE d.business_id = b.id AND ? <> '' AND d.name LIKE ?) AS matchedDishes,
                (SELECT ROUND(AVG(r.authenticity), 1) FROM reviews r
                  WHERE r.business_id = b.id) AS avgAuthenticity
           FROM businesses b
          WHERE (? IS NULL OR b.cuisine = ?)
            AND (? = '' OR b.name LIKE ?
                 OR EXISTS (SELECT 1 FROM dishes d
                             WHERE d.business_id = b.id AND d.name LIKE ?))
         HAVING distanceKm <= ?
          ORDER BY distanceKm ASC
          LIMIT ?`,
        [origin, q, like, cuisine, cuisine, q, like, like, Number(radiusKm), Number(limit)]
      );
      return rows.map((r) => ({
        ...r,
        lat: Number(r.lat),
        lng: Number(r.lng),
        distanceKm: Number(r.distanceKm),
        avgAuthenticity: r.avgAuthenticity === null ? null : Number(r.avgAuthenticity),
        matchedDishes: r.matchedDishes ? r.matchedDishes.split(', ') : [],
      }));
    },

    async getBusinessById(id) {
      const [rows] = await pool.query(
        `SELECT id, name, description, story, cuisine, vendor_type AS vendorType,
                price_level AS priceLevel, address, is_licensed AS isLicensed,
                ST_Latitude(location) AS lat, ST_Longitude(location) AS lng
           FROM businesses WHERE id = ?`,
        [id]
      );
      if (rows.length === 0) return null;
      const business = rows[0];
      const [dishes] = await pool.query(
        `SELECT id, name, description, price_cents AS priceCents, is_vegetarian AS isVegetarian
           FROM dishes WHERE business_id = ? ORDER BY name`,
        [id]
      );
      const [reviews] = await pool.query(
        `SELECT id, author_name AS authorName, authenticity, taste, value, comment, created_at AS createdAt
           FROM reviews WHERE business_id = ? ORDER BY created_at DESC LIMIT 50`,
        [id]
      );
      return {
        ...business,
        lat: Number(business.lat),
        lng: Number(business.lng),
        isLicensed: Boolean(business.isLicensed),
        dishes: dishes.map((d) => ({ ...d, isVegetarian: Boolean(d.isVegetarian) })),
        reviews,
      };
    },

    async createBusiness(b) {
      const [result] = await pool.query(
        `INSERT INTO businesses
           (name, description, story, cuisine, vendor_type, price_level, address, is_licensed, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))`,
        [
          b.name, b.description ?? null, b.story ?? null, b.cuisine, b.vendorType,
          b.priceLevel, b.address, b.isLicensed ? 1 : 0, pointWkt(b.lat, b.lng),
        ]
      );
      return result.insertId;
    },

    async businessExists(id) {
      const [rows] = await pool.query('SELECT 1 FROM businesses WHERE id = ?', [id]);
      return rows.length > 0;
    },

    async createReview(businessId, r) {
      const [result] = await pool.query(
        `INSERT INTO reviews (business_id, author_name, authenticity, taste, value, comment)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [businessId, r.authorName, r.authenticity, r.taste, r.value, r.comment ?? null]
      );
      return result.insertId;
    },
  };
}

module.exports = { createRepository, pointWkt };
