/** Default public page content (markdown-lite). Editable from Admin > Pages. Legal pages should be reviewed by counsel before launch. */
export const CMS_DEFAULTS: { slug: string; title: string; isLegal: boolean; body: string }[] = [
  {
    slug: "about", title: "About Nargito", isLegal: false,
    body: `## Who we are
Nargito is a professional social network for people and businesses who want to connect, travel and trade close to home. Members publish posts, share trips, list products and services, and talk to each other directly.

## What you can do
- Build a profile and grow a trusted network of connections.
- Share trips and meet fellow travellers.
- Create a company or shop page and publish a catalogue of products and services.
- Send enquiries to sellers and service providers and keep the whole conversation in one place.
- Discover people and businesses nearby using approximate, privacy-preserving location.

## How we work
Nargito is built around enquiries rather than checkout. We connect buyers and sellers; the agreement between them is theirs to make. We keep your precise location and private messages private, and we publish clear community guidelines that we enforce consistently.`,
  },
  {
    slug: "contact", title: "Contact us", isLegal: false,
    body: `Questions, feedback or a problem to report? Use the form below and our team will reply by email.

For urgent safety concerns about a post, listing or account, use the **Report** option on the content itself so that it reaches our moderators immediately.`,
  },
  {
    slug: "help", title: "Help centre", isLegal: false,
    body: `## Getting started
1. **Create your account** and verify your email address.
2. **Complete your profile** with a photo, headline and a short bio.
3. **Follow people and businesses** to fill your home feed.

## Posting
Use the composer at the top of the home feed to share text, photos, videos and documents. You can choose who sees each post and save drafts.

## Trips
Open **Create > Share a trip** to publish a plan with dates, itinerary and available slots. People can ask you questions or request to join.

## Selling
Create a shop or company page, then list products and services. Buyers send an enquiry from the listing and you reply in Messages.

## Account and privacy
Visit **Settings** to change your password, control who can see your profile, choose notifications and manage your location preferences.

## Still stuck?
Visit the [contact page](/contact) and tell us what happened.`,
  },
  {
    slug: "faq", title: "Frequently asked questions", isLegal: false,
    body: `## Is Nargito free?
Creating an account, posting and messaging are free. Optional Pro features may be offered; they are always clearly labelled.

## Can I buy products on Nargito?
Nargito currently supports enquiries: you contact the seller, agree the details and complete the transaction between yourselves. There is no checkout on the platform.

## Is my location shared?
No precise location is ever shown to other members. If you enable nearby discovery we only use a coarse area, and you can switch it off at any time in **Settings > Location**.

## How do I report something?
Use the Report option on any post, comment, listing, trip, profile or group. Moderators review every report.

## How do I delete my account?
Go to **Settings > Account** and request deletion. We will remove your personal data after a short confirmation period, except where the law requires us to keep it.`,
  },
  {
    slug: "community-guidelines", title: "Community guidelines", isLegal: false,
    body: `Nargito works when people feel safe and respected. By using the platform you agree to:

## Be respectful
No harassment, threats, hate speech or discrimination based on race, religion, gender, caste, nationality, disability or sexual orientation.

## Be honest
Do not impersonate others, post misleading listings, or run scams. Describe products, services and trips accurately.

## Keep it lawful
No illegal goods or services, no content that exploits or endangers children, and no content that infringes someone else's rights.

## Respect privacy
Do not publish other people's private information, including precise locations or contact details, without their consent.

## No spam
Do not post repetitive or unsolicited promotional content or manipulate engagement.

## Enforcement
We may remove content, restrict features, suspend or ban accounts that break these guidelines. You can appeal a decision by contacting support.`,
  },
  {
    slug: "privacy", title: "Privacy policy", isLegal: true,
    body: `*Last updated: see revision history. This policy is a template and should be reviewed by legal counsel for your jurisdiction before launch.*

## What we collect
- **Account data:** name, username, email address, optional phone number and profile details you choose to add.
- **Content:** posts, comments, messages, listings, trips and uploaded media.
- **Usage and security data:** sign-in events, IP address, device information and diagnostic logs.
- **Location:** only a coarse area if you choose to enable nearby discovery. We never display or store precise coordinates in public data.

## How we use it
To provide the service, keep it secure, moderate content, send the notifications you request, and improve reliability. We do not sell personal data.

## Who can see what
Profile fields follow your privacy settings. Private messages are visible only to the participants. Verification documents are visible only to authorised reviewers.

## Retention
We keep data while your account is active. Deleted content is removed from our systems after a short grace period; security and audit logs are kept for a limited period for safety and legal reasons.

## Your rights
You can access, correct, export or delete your data from **Settings**, or by contacting us.

## Cookies
See the [cookie policy](/cookies).

## Contact
Questions about this policy? Use the [contact page](/contact).`,
  },
  {
    slug: "terms", title: "Terms of service", isLegal: true,
    body: `*This document is a template and should be reviewed by legal counsel before launch.*

## Using Nargito
You must be at least 16 years old and provide accurate information. You are responsible for activity on your account and for keeping your credentials secure.

## Your content
You keep ownership of what you post. You grant Nargito a licence to host, display and distribute it as needed to run the service. You must have the rights to anything you upload.

## Listings and enquiries
Nargito helps members contact each other. We are not a party to transactions between members and do not guarantee products, services or trips listed by them.

## Prohibited conduct
You must follow the [community guidelines](/community-guidelines). We may remove content or restrict accounts that violate them.

## Paid features
Optional paid plans, when available, are described at the time of purchase and are governed by the plan terms and applicable refund rules.

## Termination
You may delete your account at any time. We may suspend or terminate accounts that breach these terms.

## Liability
To the fullest extent permitted by law, the service is provided "as is" without warranties, and our liability is limited.

## Changes
We may update these terms and will notify members of material changes.`,
  },
  {
    slug: "cookies", title: "Cookie policy", isLegal: true,
    body: `Nargito uses a small number of cookies:

| Cookie | Purpose |
| --- | --- |
| nargito_session | Keeps you signed in (essential, HTTP-only). |
| nargito_theme | Remembers light, dark or system theme. |
| nargito_locale | Remembers your chosen language. |

We do not use advertising or cross-site tracking cookies. If this changes, we will ask for your consent first.`,
  },
  {
    slug: "safety", title: "Safety centre", isLegal: false,
    body: `## Staying safe when you trade
- Keep conversations on Nargito so there is a record.
- Meet in public places and bring a friend when meeting a seller or fellow traveller for the first time.
- Never pay in advance to someone you do not know and never share one-time codes or passwords.
- Check seller profiles: verified badges, history and reviews from the community.

## Staying safe when you travel together
- Share your itinerary with someone you trust.
- Confirm plans and costs in writing before the trip.
- Your live location is never shared on Nargito.

## Reporting
Use **Report** on any content or profile. In an emergency contact your local emergency services first.`,
  },
  {
    slug: "accessibility", title: "Accessibility", isLegal: false,
    body: `Nargito aims to meet the principles of WCAG 2.2 AA. We support keyboard navigation, visible focus, semantic structure, labelled form controls, sufficient colour contrast, reduced-motion preferences and screen-reader announcements for status messages.

Accessibility is ongoing work and complete conformance requires manual testing with assistive technologies and expert review. If you find a barrier, please tell us through the [contact page](/contact) and we will work to fix it.`,
  },
];
