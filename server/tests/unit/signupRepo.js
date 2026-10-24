// Route-test double. Real transactional SQL is exercised by integration tests.
function createSignupRepo(kind = 'email', users = []) {
 const challenges=new Map();
 const repo = { users,challenges,
  async findUserByEmail(email){return users.find(u=>u.email===email)??null;},
  async findUserById(id){return users.find(u=>u.id===id)??null;},
  async reserveSignupCode(d){
   const old=challenges.get(d.email);
   if(old&&d.now<old.sentAt+60000)return {status:'limited',retryAfter:60};
   const windowStart=old&&d.now-old.windowStart<3600000?old.windowStart:d.now;
   const count=old&&windowStart===old.windowStart?old.count+1:1;
   if(count>5)return {status:'limited',retryAfter:3600};
   challenges.set(d.email,{...d,sentAt:d.now,windowStart,count,attempts:0});return {status:'ready'};
  },
  async invalidateSignupCode(email,hash){const r=challenges.get(email);if(r?.codeHash===hash)r.codeHash=null;},
  async verifySignupCode(d){
   const r=challenges.get(d.email);
   if(!r?.codeHash||r.expiresAt<=d.now)return {status:'invalid'};
   if(r.attempts>=5)return {status:'locked'};
   if(d.checkCode&&!r.providerSid)return {status:'invalid'};
   const approved=d.checkCode?await d.checkCode(r.providerSid):r.codeHash===d.codeHash;
   if(approved!==true)return {status:++r.attempts>=5?'locked':'invalid'};
   Object.assign(r,{codeHash:null,tokenHash:d.tokenHash,verifiedUntil:d.verifiedUntil});return {status:'verified'};
  },
  async createVerifiedUser(d){
   const r=challenges.get(d.email);
   if(!r||r.tokenHash!==d.tokenHash||r.verifiedUntil<=d.now)return null;
   if(users.some(u=>u[kind]===d.email)){const e=new Error();e.code='ER_DUP_ENTRY';throw e;}
   const u={id:users.length+1,name:r.name,email:kind === 'email' ? d.email : null,
    ...(kind === 'phone' ? {phone:d.email} : {}),passwordHash:d.passwordHash,role:'explorer'};
   users.push(u);challenges.delete(d.email);return u;
  }
 };
 if (kind === 'email') {
  const phoneRepo = createSignupRepo('phone', users);
  repo.phoneChallenges = phoneRepo.challenges;
  repo.findUserByPhone = async phone => users.find(u => u.phone === phone) ?? null;
  const phoneDetails = ({phone, ...rest}) => ({email:phone, ...rest});
  repo.reservePhoneSignupCode = d => phoneRepo.reserveSignupCode(phoneDetails(d));
  repo.invalidatePhoneSignupCode = (phone,hash) => phoneRepo.invalidateSignupCode(phone,hash);
  repo.activatePhoneSignupCode = async (phone, hash, sid, timestamp) => {
   const r=phoneRepo.challenges.get(phone);
   if(!r || r.codeHash!==hash || r.expiresAt<=timestamp || !/^VE[0-9a-fA-F]{32}$/.test(sid || ''))return false;
   r.providerSid=sid;return true;
  };
  repo.verifyPhoneSignupCode = d => phoneRepo.verifySignupCode(phoneDetails(d));
  repo.createPhoneVerifiedUser = d => phoneRepo.createVerifiedUser(phoneDetails(d));
 }
 return repo;
}
module.exports={createSignupRepo};
