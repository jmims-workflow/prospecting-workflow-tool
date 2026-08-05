- **Front end**: React with React Router, Firebase Auth for Google sign-in, and real-time Firestore listeners so the dashboard updates live as data changes.
- **Back end**: A small Express server handling outbound email. It tries the user's own Gmail account first (using the OAuth token and scope granted at login), and falls back to a transactional email API if no Gmail token is present. It also catches specific Gmail failure modes (expired token, API not yet enabled on the project) and returns a usable, human-readable message instead of a raw error.
- **Data and access control**: Firestore security rules enforce that every user can only read and write their own records, validate required fields and types before a write is accepted, and default-deny anything not explicitly allowed. See `firestore.rules`.

## Human-in-the-Loop Design

The tool automates the scheduling and tracking around outreach, but keeps judgment calls with the user:

- Message content is drafted and reviewed before sending, not sent blind
- Call steps require the user to confirm completion manually rather than being marked done automatically
- Enrollment can be paused or skipped at any point

## Limitations

This is a working prototype built for one person's actual workflow, not a production, multi-tenant SaaS product. It does not currently include:

- Team or admin-level visibility across multiple users' pipelines
- Deliverability tooling (bounce handling, warm-up, sending limits)
- CRM integration or data import/export
- Formal audit logging or data retention policy beyond what Firestore rules enforce
- Automated compliance checks (unsubscribe handling, sending-frequency limits)

## What I'd Add for Production

- Role-based access for managers or team leads
- Structured logging and monitoring on the backend
- Rate limiting on send actions
- A formal data retention and deletion policy
- Automated tests around the enrollment and sequence-advancement logic

## Stack

React, TypeScript, Vite, Tailwind CSS, Firebase (Auth + Firestore), Express, Google Gmail API, Resend (fallback email provider).

## Setup

1. Install dependencies: `npm install`
2. Add your own Firebase project config to `firebase-applet-config.json` (placeholder values are included in this repo)
3. Set any required environment variables (Gemini API key, Resend API key) in a local `.env` file
4. Run locally: `npm run dev`

Note: the config file in this repo uses placeholder values. Real credentials for the original deployment are not included.
