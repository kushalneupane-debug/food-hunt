// Twilio Verify generates and checks phone codes; SMTP email codes remain local.
function createSmsSender(env = process.env, send = fetch) {
  const { TWILIO_ACCOUNT_SID: account, TWILIO_AUTH_TOKEN: token,
    TWILIO_VERIFY_SERVICE_SID: service } = env;
  if (!account || !token || !service) return null;
  if (!/^AC[0-9a-fA-F]{32}$/.test(account) || !/^VA[0-9a-fA-F]{32}$/.test(service)) {
    throw new Error('Invalid Verify configuration. Check the Twilio account and VA Service SID.');
  }

  async function post(resource, fields) {
    let response, result;
    try {
      response = await send(`https://verify.twilio.com/v2/Services/${service}/${resource}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields),
      });
      result = await response.json();
    } catch {
      throw new Error('Phone verification provider is unavailable.');
    }
    if (!response.ok) {
      // Only selected numeric diagnostics may reach application logs.
      const error = new Error('Phone verification provider rejected the request.');
      error.httpStatus = response.status;
      error.providerCode = Number.isInteger(result?.code) ? result.code : null;
      throw error;
    }
    return result;
  }

  function matches(result, phone, sid) {
    return result?.sid === sid && result.to === phone && result.channel === 'sms' &&
      result.service_sid === service && result.account_sid === account;
  }

  return {
    async sendSignupCode({ phone }) {
      const result = await post('Verifications', { To: phone, Channel: 'sms' });
      if (!/^VE[0-9a-fA-F]{32}$/.test(result?.sid || '') ||
          result.status !== 'pending' || !matches(result, phone, result.sid)) {
        throw new Error('Phone verification provider did not start a verification.');
      }
      return { verificationSid: result.sid };
    },
    async checkSignupCode({ phone, code, verificationSid }) {
      if (!/^VE[0-9a-fA-F]{32}$/.test(verificationSid || '')) return false;
      let result;
      try {
        result = await post('VerificationCheck', { To: phone, Code: code });
      } catch (error) {
        // Expired, consumed, or too many guesses: never treat as approved.
        if (error.httpStatus === 404 || error.providerCode === 60202) return false;
        throw error;
      }
      return matches(result, phone, verificationSid) && result.status === 'approved';
    },
  };
}
module.exports = { createSmsSender };
