jest.mock('nodemailer',()=>({createTransport:jest.fn()}));
const nodemailer=require('nodemailer');
const {createMailer}=require('../../src/mailer');
beforeEach(()=>jest.clearAllMocks());
test('does not provide a console bypass when SMTP is missing',()=>{
 expect(createMailer({})).toBe(null);expect(nodemailer.createTransport).not.toHaveBeenCalled();
});
test('uses TLS settings and sends plain-text code without SMTP debugging',async()=>{
 const sendMail=jest.fn(async()=>({accepted:['person@example.com']}));
 nodemailer.createTransport.mockReturnValue({sendMail});
 const mailer=createMailer({SMTP_HOST:'smtp.example.com',SMTP_PORT:'587',SMTP_USER:'user',SMTP_PASSWORD:'test',MAIL_FROM:'Food Hunt <sender@example.com>'});
 await mailer.sendSignupCode({email:'person@example.com',code:'012345'});
 expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({secure:false,requireTLS:true}));
 expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({to:'person@example.com',text:expect.stringContaining('012345')}));
});
test('port 465 uses immediate TLS',()=>{
 createMailer({SMTP_HOST:'smtp.example.com',SMTP_PORT:'465',MAIL_FROM:'sender@example.com'});
 expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({secure:true}));
});
test('refused recipients do not count as a sent code',async()=>{
 nodemailer.createTransport.mockReturnValue({sendMail:async()=>({accepted:[]})});
 await expect(createMailer({SMTP_HOST:'smtp.example.com',MAIL_FROM:'sender@example.com'}).sendSignupCode({email:'person@example.com',code:'123456'})).rejects.toThrow();
});
