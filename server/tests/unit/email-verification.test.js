const request=require('supertest');
const {createApp}=require('../../src/app');
const {createSignupRepo}=require('./signupRepo');
const {hashCode,hashToken}=require('../../src/signup-verification');
const SECRET='test-only-email-verification-secret';
const contact={name:'Code Explorer',email:'code@example.com'};
let repo,app,outbox,time,mailer;
beforeEach(()=>{
 time=1800000000000;repo=createSignupRepo();outbox=[];
 mailer={sendSignupCode:jest.fn(async message=>outbox.push(message))};
 app=createApp({repo,jwtSecret:SECRET,mailer,now:()=>time});
});
const send=(details=contact)=>request(app).post('/api/auth/signup/request-code').send(details);
const verify=(code=outbox.at(-1).code,email=contact.email)=>request(app).post('/api/auth/signup/verify-code').send({email,code});
const finish=(verificationToken,email=contact.email)=>request(app).post('/api/auth/register').send({email,password:'SecureLocal2026!',verificationToken});
test('sends six digits, normalizes email, returns no code, stores only HMAC',async()=>{
 const r=await send({name:contact.name,email:' CODE@EXAMPLE.COM '});
 expect(r.status).toBe(202);expect(outbox[0].code).toMatch(/^\d{6}$/);expect(outbox[0].email).toBe(contact.email);
 expect(r.body).not.toHaveProperty('code');expect(repo.challenges.get(contact.email).codeHash).toBe(hashCode(SECRET,contact.email,outbox[0].code));
 expect(r.headers['cache-control']).toBe('no-store');
});
test('blocks old registration and fabricated grants',async()=>{
 expect((await request(app).post('/api/auth/register').send({...contact,password:'SecureLocal2026!'})).status).toBe(400);
 expect((await finish('a'.repeat(64))).status).toBe(400);expect(repo.users).toHaveLength(0);
});
test('locks after five wrong attempts, even for the correct code',async()=>{
 await send();const wrong=outbox[0].code==='000000'?'111111':'000000';
 for(let i=0;i<4;i++)expect((await verify(wrong)).status).toBe(400);
 expect((await verify(wrong)).status).toBe(429);expect((await verify()).status).toBe(429);
});
test('rejects expired codes',async()=>{await send();time+=600000;expect((await verify()).status).toBe(400);});
test('enforces resend cooldown and five sends per hour',async()=>{
 await send();expect((await send()).status).toBe(429);
 for(let i=0;i<4;i++){time+=60000;expect((await send()).status).toBe(202);}
 time+=60000;expect((await send()).status).toBe(429);expect(outbox).toHaveLength(5);
});
test('resending revokes previous verification grant',async()=>{
 await send();const r=await verify();time+=60000;await send();expect((await finish(r.body.verificationToken)).status).toBe(400);
});
test('verification consumes code and stores a hashed grant that expires',async()=>{
 await send();const r=await verify();expect(r.status).toBe(200);
 expect(repo.challenges.get(contact.email).tokenHash).toBe(hashToken(r.body.verificationToken));
 expect((await verify()).status).toBe(400);time+=600000;expect((await finish(r.body.verificationToken)).status).toBe(400);
});
test('grant is email bound and single use',async()=>{
 await send();const r=await verify();expect((await finish(r.body.verificationToken,'other@example.com')).status).toBe(400);
 const created=await finish(r.body.verificationToken);expect(created.status).toBe(201);expect(created.body.user.name).toBe(contact.name);
 expect(repo.challenges.has(contact.email)).toBe(false);expect((await finish(r.body.verificationToken)).status).toBe(409);expect(repo.users).toHaveLength(1);
});
test('delivery failure invalidates code without exposing SMTP diagnostics',async()=>{
 mailer.sendSignupCode.mockRejectedValue(new Error('private SMTP diagnostic'));
 const r=await send();expect(r.status).toBe(503);expect(JSON.stringify(r.body)).not.toContain('private');expect(repo.challenges.get(contact.email).codeHash).toBe(null);
});
test('missing SMTP blocks signup but existing login still responds',async()=>{
 app=createApp({repo,jwtSecret:SECRET});expect((await send()).status).toBe(503);
 expect((await request(app).post('/api/auth/login').send({email:contact.email,password:'wrong'})).status).toBe(401);
});
test('malformed codes rejected',async()=>{expect((await verify('12x456')).status).toBe(400);});
test('IP rate limit caps requests across different email addresses',async()=>{
 for(let i=0;i<10;i++)expect((await send({...contact,email:`code${i}@example.com`})).status).toBe(202);
 expect((await send({...contact,email:'another@example.com'})).status).toBe(429);expect(outbox).toHaveLength(10);
});
