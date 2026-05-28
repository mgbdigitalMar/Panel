import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    console.log('Sending test email...');
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'carlos.ruiz@margube.com', // Let's test with whatever email they've configured, or I can just print the key
      subject: 'Test email from Resend',
      html: '<p>Test email</p>',
    });

    if (error) {
      console.error('Error from Resend:', error);
    } else {
      console.log('Success:', data);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

testEmail();
