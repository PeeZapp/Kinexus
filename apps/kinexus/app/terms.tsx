import { LegalPage } from '@/src/features/legal/LegalPage';

const CONTACT = 'pzappft@gmail.com';
const SITE = 'https://kinexus-green.vercel.app';

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="17 November 2026"
      otherHref="/privacy"
      otherLabel="Privacy Policy"
      sections={[
        {
          title: 'Agreement',
          paragraphs: [
            `These Terms govern your use of Kinexus at ${SITE} and related apps or APIs. By creating an account or using the service, you agree to them.`,
            `Contact: ${CONTACT}.`,
          ],
        },
        {
          title: 'The service',
          paragraphs: [
            'Kinexus provides household tools such as meals planning, shopping, calendar sync, training, lists, and related features. Features may change, and some may be experimental or incomplete.',
            'Optional integrations (for example Google sign-in, Google Calendar, or AI assistants) are subject to those providers’ terms as well as these Terms.',
          ],
        },
        {
          title: 'Accounts',
          paragraphs: [
            'You must provide accurate account information and keep your credentials secure. You are responsible for activity under your account.',
            'Household owners and admins control invites and shared content. Do not invite people who should not see that household’s data.',
          ],
        },
        {
          title: 'Acceptable use',
          paragraphs: [
            'Use Kinexus only for lawful purposes. Do not attempt to break into the service, abuse APIs, scrape in a way that harms others, upload malware, harass others, or use the service to violate others’ rights.',
            'You must have the right to share any content you upload or sync (including calendar data and recipes).',
          ],
        },
        {
          title: 'Your content',
          paragraphs: [
            'You retain ownership of content you create. You grant us a limited licence to host, process, and display that content solely to operate Kinexus for you and your household.',
            'You can disconnect integrations and request deletion as described in the Privacy Policy.',
          ],
        },
        {
          title: 'Third-party services',
          paragraphs: [
            'Google and other third parties are independent. Their availability, policies, and OAuth consent screens are outside our control. Calendar sync depends on valid Google authorisation; if access is revoked or expires, sync will stop until you reconnect.',
          ],
        },
        {
          title: 'Disclaimers',
          paragraphs: [
            'Kinexus is provided “as is” and “as available” without warranties of any kind, to the fullest extent permitted by law. We do not guarantee uninterrupted service, perfect accuracy of meal/training/finance suggestions, or that AI-generated content is correct.',
            'Kinexus is not medical, nutritional, financial, or legal advice.',
          ],
        },
        {
          title: 'Limitation of liability',
          paragraphs: [
            'To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or goodwill arising from your use of the service.',
            'Our total liability for any claim relating to the service is limited to the greater of (a) the amounts you paid us for the service in the 12 months before the claim, or (b) USD $50.',
          ],
        },
        {
          title: 'Termination',
          paragraphs: [
            'You may stop using Kinexus at any time. We may suspend or terminate access if you breach these Terms or if we discontinue the service.',
          ],
        },
        {
          title: 'Changes',
          paragraphs: [
            'We may update these Terms by posting a revised version with a new “Last updated” date. Continued use after changes means you accept the updated Terms.',
          ],
        },
        {
          title: 'Governing law',
          paragraphs: [
            'These Terms are governed by the laws applicable in your place of residence where required, otherwise by the laws of New South Wales, Australia, without regard to conflict-of-law rules. Courts in that jurisdiction have exclusive venue where permitted.',
          ],
        },
      ]}
    />
  );
}
