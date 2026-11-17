import { LegalPage } from '@/src/features/legal/LegalPage';

const CONTACT = 'pzappft@gmail.com';
const SITE = 'https://kinexus-green.vercel.app';

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="17 November 2026"
      otherHref="/terms"
      otherLabel="Terms of Service"
      sections={[
        {
          title: 'Who we are',
          paragraphs: [
            `Kinexus (“we”, “us”) is a household app for meals, calendar, training, lists, and related tools at ${SITE}. This policy explains what we collect and how we use it.`,
            `Questions: ${CONTACT}.`,
          ],
        },
        {
          title: 'Information we collect',
          paragraphs: [
            'Account data: email address, name or display name, profile photo if you provide one (including via Google sign-in), and authentication identifiers.',
            'Household and app content you create: meal plans, recipes, shopping lists, calendar events, training plans and sessions, lists and saves, finance entries you choose to store, settings, and household membership roles.',
            'Google Calendar (optional): if you connect Google Calendar, we store OAuth tokens and calendar IDs needed to sync events you enable. We use those tokens only to provide calendar sync.',
            'Technical data: basic logs such as IP address, device/browser type, timestamps, and error diagnostics needed to run and secure the service (for example via our hosting and database providers).',
          ],
        },
        {
          title: 'How we use information',
          paragraphs: [
            'To provide and improve Kinexus: authenticate you, sync household data, run features you use (including optional AI-assisted tools when enabled), and keep the service reliable and secure.',
            'We do not sell your personal information.',
            'We do not use Google user data for advertising. Google Calendar data is used only to sync calendars you connect, as described when you grant access.',
          ],
        },
        {
          title: 'Sharing',
          paragraphs: [
            'Household members you invite can see shared household content according to their role.',
            'Service providers that host or process data for us (for example Supabase for auth/database, Vercel for hosting, Google for sign-in and optional Calendar access, and AI providers when you use AI features). They process data on our behalf under their terms.',
            'We may disclose information if required by law or to protect the safety, rights, or integrity of users and the service.',
          ],
        },
        {
          title: 'Retention and deletion',
          paragraphs: [
            'We keep account and content data while your account is active and as needed to operate the service. You can disconnect Google Calendar at any time in Settings; we then delete stored calendar tokens for that connection.',
            `To request account or data deletion, email ${CONTACT}. We will delete or anonymise personal data we control, except where we must retain it for legal, security, or abuse-prevention reasons.`,
          ],
        },
        {
          title: 'Security',
          paragraphs: [
            'We use industry-standard safeguards appropriate to our stack (encrypted transport, access-controlled databases, and service-role secrets kept off the client). No method of transmission or storage is completely secure.',
          ],
        },
        {
          title: 'Children',
          paragraphs: [
            'Kinexus is intended for adults managing a household. Children may appear as household members only under an adult’s account and supervision. We do not knowingly collect personal information directly from children under 13 for their own accounts.',
          ],
        },
        {
          title: 'International users',
          paragraphs: [
            'We may process data in the countries where our providers operate. By using Kinexus you understand your information may be transferred to and processed in those locations.',
          ],
        },
        {
          title: 'Changes',
          paragraphs: [
            'We may update this policy. We will change the “Last updated” date on this page. Continued use after changes means you accept the updated policy.',
          ],
        },
      ]}
    />
  );
}
