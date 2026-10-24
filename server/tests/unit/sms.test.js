const { createSmsSender } = require('../../src/sms');
const account = `AC${'1'.repeat(32)}`, service = `VA${'2'.repeat(32)}`, sid = `VE${'3'.repeat(32)}`;
const env = { TWILIO_ACCOUNT_SID: account, TWILIO_AUTH_TOKEN: 'private-test-token', TWILIO_VERIFY_SERVICE_SID: service };
const phone = '+12025550123';
const result = (status='pending', overrides={}) => ({sid,service_sid:service,account_sid:account,to:phone,channel:'sms',status,...overrides});
const response = data => ({ok:true,status:200,json:async()=>data});

test('missing Verify service disables phone delivery, including old Messaging-only settings', () => {
  expect(createSmsSender({})).toBe(null);
  expect(createSmsSender({...env,TWILIO_AUTH_TOKEN:''})).toBe(null);
  expect(createSmsSender({...env,TWILIO_VERIFY_SERVICE_SID:'',TWILIO_PHONE_NUMBER:'+12025550100'})).toBe(null);
});
test('starts Verify with only recipient and channel, with backend authentication and a timeout', async () => {
  const send=jest.fn(async()=>response(result()));
  expect(await createSmsSender(env,send).sendSignupCode({phone})).toEqual({verificationSid:sid});
  const [url,options]=send.mock.calls[0];
  expect(url).toBe(`https://verify.twilio.com/v2/Services/${service}/Verifications`);
  expect(Object.fromEntries(options.body)).toEqual({To:phone,Channel:'sms'});
  expect(options.headers.Authorization).toBe(`Basic ${Buffer.from(`${account}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`);
  expect(options.signal).toBeDefined();expect(options.redirect).toBe('error');
});
test('checks the stored verification SID and code; only approved matches succeed', async () => {
  const send=jest.fn(async()=>response(result('approved')));
  expect(await createSmsSender(env,send).checkSignupCode({phone,code:'654321',verificationSid:sid})).toBe(true);
  expect(send.mock.calls[0][0]).toBe(`https://verify.twilio.com/v2/Services/${service}/VerificationCheck`);
  expect(Object.fromEntries(send.mock.calls[0][1].body)).toEqual({To:phone,Code:'654321'});
  for(const status of ['pending','canceled','expired','max_attempts_reached','failed']) {
    const client=createSmsSender(env,async()=>response(result(status,{valid:true})));
    expect(await client.checkSignupCode({phone,code:'654321',verificationSid:sid})).toBe(false);
  }
});
test('an approved response for a different contact, account, service or verification cannot authorize signup', async () => {
  for(const changes of [{to:'+12025550124'},{sid:`VE${'4'.repeat(32)}`},{account_sid:`AC${'4'.repeat(32)}`},{service_sid:`VA${'4'.repeat(32)}`},{channel:'email'}]) {
    const client=createSmsSender(env,async()=>response(result('approved',changes)));
    expect(await client.checkSignupCode({phone,code:'654321',verificationSid:sid})).toBe(false);
  }
});
test('provider failure retains only numeric diagnostics, never raw error response content', async () => {
  const client=createSmsSender(env,async()=>({ok:false,status:401,json:async()=>({code:20003,message:'private provider diagnostic'})}));
  await expect(client.sendSignupCode({phone})).rejects.toMatchObject({httpStatus:401,providerCode:20003,message:'Phone verification provider rejected the request.'});
});
test('expired/used provider SID and provider guess limit never approve', async () => {
  for(const [status,code] of [[404,20404],[429,60202]]) {
    const client=createSmsSender(env,async()=>({ok:false,status,json:async()=>({code})}));
    expect(await client.checkSignupCode({phone,code:'654321',verificationSid:sid})).toBe(false);
  }
});
test('rejects malformed provider responses and invalid service configuration', async () => {
  for(const data of [null,{},result('approved'),result('pending',{to:'+12025550124'})]) {
    await expect(createSmsSender(env,async()=>response(data)).sendSignupCode({phone})).rejects.toThrow(/verification provider/);
  }
  expect(()=>createSmsSender({...env,TWILIO_VERIFY_SERVICE_SID:sid})).toThrow('Invalid Verify configuration');
});
test('network timeouts, empty JSON, and malformed verification IDs fail closed', async () => {
  for(const send of [async()=>{throw new Error('private network details');},async()=>({json:async()=>{throw new Error('unexpected JSON');}})]) {
    await expect(createSmsSender(env,send).sendSignupCode({phone})).rejects.toThrow('Phone verification provider is unavailable.');
  }
  const send=jest.fn();
  expect(await createSmsSender(env,send).checkSignupCode({phone,code:'654321',verificationSid:'fake'})).toBe(false);
  expect(send).not.toHaveBeenCalled();
});
