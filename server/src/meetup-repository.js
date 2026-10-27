// Hunt Together: food meetups at listed places. All meetup SQL lives here.
//
// Safety rules enforced in this layer:
// - meetups only happen at places already listed on Food Hunt (public businesses)
// - other people see only first names, never emails or phone numbers
// - a meetup with REPORT_HIDE_AT or more reports is hidden from everyone but its host

const REPORT_HIDE_AT = 3;
const MAX_HOSTED_UPCOMING = 3;

const toMysqlDate = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
// Times are stored in UTC and read back as ISO strings, so the server's time zone never matters.
const UTC_ISO = (col) => `DATE_FORMAT(${col}, '%Y-%m-%dT%H:%i:%sZ')`;
const fromMysqlDate = (iso) => new Date(iso);

const firstName = (expr) => `SUBSTRING_INDEX(TRIM(${expr}), ' ', 1)`;

const MEETUP_COLUMNS = `
  m.id, m.craving, m.note, ${UTC_ISO('m.starts_at')} AS startsAt, m.max_people AS maxPeople, m.status, m.host_id AS hostId,
  ${firstName('h.name')} AS hostName,
  (SELECT COUNT(*) FROM meetup_members mm WHERE mm.meetup_id = m.id) AS going,
  (SELECT COUNT(*) FROM meetup_reports mr WHERE mr.meetup_id = m.id) AS reports,
  b.id AS placeId, b.name AS placeName, b.address AS placeAddress, b.category AS placeCategory,
  b.cuisine AS placeCuisine, b.subcategory AS placeSubcategory,
  ST_Latitude(b.location) AS placeLat, ST_Longitude(b.location) AS placeLng`;

function shape(row, userId, memberIds = null) {
  const going = Number(row.going);
  return {
    id: row.id,
    craving: row.craving,
    note: row.note,
    startsAt: fromMysqlDate(row.startsAt).toISOString(),
    maxPeople: Number(row.maxPeople),
    going,
    spotsLeft: Math.max(0, Number(row.maxPeople) - going),
    status: row.status,
    hostName: row.hostName,
    isHost: userId != null && Number(row.hostId) === Number(userId),
    joined: memberIds ? memberIds.includes(Number(userId)) : Boolean(Number(row.joined || 0)),
    distanceKm: row.distanceKm == null ? undefined : Number(row.distanceKm),
    place: {
      id: row.placeId,
      name: row.placeName,
      address: row.placeAddress,
      category: row.placeCategory,
      cuisine: row.placeCuisine,
      subcategory: row.placeSubcategory,
      lat: Number(row.placeLat),
      lng: Number(row.placeLng),
    },
  };
}

function createMeetupRepository(pool) {
  // Locks the meetup row so two people can't take the last seat at once.
  async function withMeetupLock(meetupId, fn) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT id, host_id AS hostId, status, ${UTC_ISO('starts_at')} AS startsAt, max_people AS maxPeople
           FROM meetups WHERE id = ? FOR UPDATE`,
        [meetupId]
      );
      const result = rows.length ? await fn(conn, rows[0]) : 'not_found';
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  return {
    /** Upcoming open meetups near a point, soonest first. */
    async listMeetups({ lat, lng, radiusKm = 40, userId = null, now = Date.now(), limit = 30 }) {
      const [rows] = await pool.query(
        `SELECT ${MEETUP_COLUMNS},
                EXISTS (SELECT 1 FROM meetup_members j WHERE j.meetup_id = m.id AND j.user_id = ?) AS joined,
                ROUND(ST_Distance_Sphere(b.location,
                      ST_GeomFromText(?, 4326, 'axis-order=long-lat')) / 1000, 2) AS distanceKm
           FROM meetups m
           JOIN businesses b ON b.id = m.business_id
           JOIN users h ON h.id = m.host_id
          WHERE m.status = 'open' AND m.starts_at > ?
         HAVING distanceKm <= ? AND (reports < ? OR hostId = ?)
          ORDER BY m.starts_at ASC
          LIMIT ?`,
        [userId ?? 0, `POINT(${Number(lng)} ${Number(lat)})`, toMysqlDate(now),
          Number(radiusKm), REPORT_HIDE_AT, userId ?? 0, Number(limit)]
      );
      return rows.map((r) => shape(r, userId));
    },

    /** One meetup with the first names of everyone going. */
    async getMeetup(id, userId = null) {
      const [rows] = await pool.query(
        `SELECT ${MEETUP_COLUMNS}
           FROM meetups m
           JOIN businesses b ON b.id = m.business_id
           JOIN users h ON h.id = m.host_id
          WHERE m.id = ?`,
        [id]
      );
      if (!rows.length) return null;
      const [members] = await pool.query(
        `SELECT mm.user_id AS userId, ${firstName('u.name')} AS name
           FROM meetup_members mm JOIN users u ON u.id = mm.user_id
          WHERE mm.meetup_id = ? ORDER BY mm.joined_at, mm.user_id`,
        [id]
      );
      const ids = members.map((m) => Number(m.userId));
      const meetup = shape(rows[0], userId, ids);
      if (Number(rows[0].reports) >= REPORT_HIDE_AT && !meetup.isHost) return null;
      // Names of who's going are shown to people in the group only.
      meetup.members = meetup.joined ? members.map((m) => m.name) : [];
      return meetup;
    },

    /** Returns { id } or { error: 'place_not_found' | 'too_many' }. */
    async createMeetup({ hostId, businessId, craving, note = null, startsAt, maxPeople, now = Date.now() }) {
      const [place] = await pool.query('SELECT id FROM businesses WHERE id = ?', [businessId]);
      if (!place.length) return { error: 'place_not_found' };
      const [[{ n }]] = await pool.query(
        "SELECT COUNT(*) AS n FROM meetups WHERE host_id = ? AND status = 'open' AND starts_at > ?",
        [hostId, toMysqlDate(now)]
      );
      if (Number(n) >= MAX_HOSTED_UPCOMING) return { error: 'too_many' };

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO meetups (business_id, host_id, craving, note, starts_at, max_people)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [businessId, hostId, craving, note, toMysqlDate(Date.parse(startsAt)), maxPeople]
        );
        await conn.query('INSERT INTO meetup_members (meetup_id, user_id) VALUES (?, ?)', [result.insertId, hostId]);
        await conn.commit();
        return { id: result.insertId };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },

    /** 'joined' | 'already' | 'full' | 'closed' | 'not_found' */
    joinMeetup(id, userId, now = Date.now()) {
      return withMeetupLock(id, async (conn, m) => {
        if (m.status !== 'open' || fromMysqlDate(m.startsAt).getTime() <= now) return 'closed';
        const [mine] = await conn.query('SELECT 1 FROM meetup_members WHERE meetup_id = ? AND user_id = ?', [id, userId]);
        if (mine.length) return 'already';
        const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM meetup_members WHERE meetup_id = ?', [id]);
        if (Number(n) >= Number(m.maxPeople)) return 'full';
        await conn.query('INSERT INTO meetup_members (meetup_id, user_id) VALUES (?, ?)', [id, userId]);
        return 'joined';
      });
    },

    /** 'left' | 'not_member' | 'host' | 'not_found' */
    leaveMeetup(id, userId) {
      return withMeetupLock(id, async (conn, m) => {
        if (Number(m.hostId) === Number(userId)) return 'host';
        const [r] = await conn.query('DELETE FROM meetup_members WHERE meetup_id = ? AND user_id = ?', [id, userId]);
        return r.affectedRows ? 'left' : 'not_member';
      });
    },

    /** 'cancelled' | 'not_host' | 'not_found' */
    cancelMeetup(id, userId) {
      return withMeetupLock(id, async (conn, m) => {
        if (Number(m.hostId) !== Number(userId)) return 'not_host';
        await conn.query("UPDATE meetups SET status = 'cancelled' WHERE id = ?", [id]);
        return 'cancelled';
      });
    },

    /** 'reported' | 'already' | 'not_found' */
    async reportMeetup(id, userId, reason) {
      const [exists] = await pool.query('SELECT 1 FROM meetups WHERE id = ?', [id]);
      if (!exists.length) return 'not_found';
      const [r] = await pool.query(
        'INSERT IGNORE INTO meetup_reports (meetup_id, reporter_id, reason) VALUES (?, ?, ?)',
        [id, userId, reason]
      );
      return r.affectedRows ? 'reported' : 'already';
    },
  };
}

module.exports = { createMeetupRepository, REPORT_HIDE_AT, MAX_HOSTED_UPCOMING };
