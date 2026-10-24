// Shared transactional state machine for email and phone signup.
// Lock each contact while changing verification state to prevent concurrent reuse.
async function verificationTransaction(pool, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function createContactVerification(pool, kind) {
  if (!['email', 'phone'].includes(kind)) throw new Error('Unknown contact kind');
  const column = kind;
  const table = kind === 'email' ? 'signup_verifications' : 'phone_signup_verifications';
  return {
    async reserveCode({ name, contact, codeHash, now, expiresAt }) {
      return verificationTransaction(pool, async (conn) => {
        await conn.query(`INSERT IGNORE INTO ${table} (${column}, name) VALUES (?, ?)`, [contact, name]);
        const [rows] = await conn.query(`SELECT * FROM ${table} WHERE ${column} = ? FOR UPDATE`, [contact]);
        const row = rows[0];
        const cooldown = Number(row.last_sent_at) + 60000 - now;
        if (cooldown > 0) return { status: 'limited', retryAfter: Math.ceil(cooldown / 1000) };
        const sameWindow = now - Number(row.window_started_at) < 3600000;
        if (sameWindow && row.send_count >= 5) {
          return { status: 'limited', retryAfter: Math.ceil((Number(row.window_started_at) + 3600000 - now) / 1000) };
        }
        await conn.query(
          `UPDATE ${table} SET name = ?, code_hash = ?, expires_at = ?,
           last_sent_at = ?, window_started_at = ?, send_count = ?, attempts = 0,
           token_hash = NULL, verified_until = 0${kind === 'phone' ? ', provider_sid = NULL' : ''} WHERE ${column} = ?`,
          [name, codeHash, expiresAt, now, sameWindow ? row.window_started_at : now,
            sameWindow ? row.send_count + 1 : 1, contact]
        );
        return { status: 'ready' };
      });
    },

    async invalidateCode(contact, codeHash) {
      await pool.query(`UPDATE ${table} SET code_hash = NULL WHERE ${column} = ? AND code_hash = ?`, [contact, codeHash]);
    },

    async activateProvider(contact, codeHash, providerSid, now) {
      if (kind !== 'phone' || !/^VE[0-9a-fA-F]{32}$/.test(providerSid || '')) return false;
      const [result] = await pool.query(
        `UPDATE ${table} SET provider_sid = ? WHERE ${column} = ? AND code_hash = ? AND expires_at > ?`,
        [providerSid, contact, codeHash, now]
      );
      return result.affectedRows === 1;
    },

    async verifyCode({ contact, codeHash, tokenHash, now, verifiedUntil, checkCode }) {
      return verificationTransaction(pool, async (conn) => {
        const [rows] = await conn.query(`SELECT * FROM ${table} WHERE ${column} = ? FOR UPDATE`, [contact]);
        const row = rows[0];
        if (!row || !row.code_hash || Number(row.expires_at) <= now) return { status: 'invalid' };
        if (row.attempts >= 5) return { status: 'locked' };
        // Serialize checks/resends for this contact. The bounded provider call
        // runs under this row lock so an approved result cannot be replayed.
        if (checkCode && !row.provider_sid) return { status: 'invalid' };
        const approved = checkCode ? await checkCode(row.provider_sid) : row.code_hash === codeHash;
        if (approved !== true) {
          await conn.query(`UPDATE ${table} SET attempts = attempts + 1 WHERE ${column} = ?`, [contact]);
          return { status: row.attempts + 1 >= 5 ? 'locked' : 'invalid' };
        }
        await conn.query(
          `UPDATE ${table} SET code_hash = NULL, token_hash = ?, verified_until = ? WHERE ${column} = ?`,
          [tokenHash, verifiedUntil, contact]
        );
        return { status: 'verified' };
      });
    },

    async createUser({ contact, passwordHash, tokenHash, now }) {
      return verificationTransaction(pool, async (conn) => {
        const [rows] = await conn.query(`SELECT * FROM ${table} WHERE ${column} = ? FOR UPDATE`, [contact]);
        const row = rows[0];
        if (!row || !row.token_hash || row.token_hash !== tokenHash || Number(row.verified_until) <= now) return null;
        const [result] = await conn.query(
          `INSERT INTO users (name, ${column}, password_hash, role) VALUES (?, ?, ?, 'explorer')`,
          [row.name, contact, passwordHash]
        );
        // Consume the grant in the same transaction as account creation.
        await conn.query(`DELETE FROM ${table} WHERE ${column} = ?`, [contact]);
        return { id: result.insertId, name: row.name, email: kind === 'email' ? contact : null,
          ...(kind === 'phone' ? { phone: contact } : {}), role: 'explorer' };
      });
    },

  };
}
module.exports = { createContactVerification };
