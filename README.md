# Human-in-the-Loop Sales Outreach Workflow

> A lightweight AI-enabled outreach application built to solve a real prospecting workflow problem.
> 
> The project began when a salesperson lost access to the sales-engagement platform she had relied on after it was removed from her company’s tech stack. Rather than recreate an enterprise platform, I focused on the parts of her workflow creating the most friction and built a working prototype around them.
> 
> The goal was simple: reduce repetitive work, restore visibility into follow-up activity, and use AI where it was useful without removing human judgment.

---

## Discovery

Before building, I spent time understanding how the salesperson actually worked, where the process was breaking down, what tools were already available, and what constraints needed to be respected.

The discovery conversation focused on:

- Where manual work consumed the most time
- What happened to prospecting while traveling
- Which systems were already part of the workflow
- What tools and data could safely be used
- What a meaningfully better week would look like

### What I Learned

The biggest problem was not simply the absence of an outreach platform.

Without a sequencing tool, the salesperson was repeatedly reconstructing context:

- Searching sent email to find the last interaction
- Trying to avoid contacting someone too soon
- Determining the last point of contact
- Tracking follow-ups across prospects and existing customers
- Figuring out what needed to happen next

Travel created another break in the process. Because she did not have SDR support, prospecting often stopped while she was on the road.

Her existing environment included Salesforce, Microsoft tools, OneNote, and Gainsight, but those systems did not provide the lightweight day-to-day workflow she needed.

There were also data-handling constraints. Her organization preferred approved Microsoft AI tools for internal information and discouraged putting company data into external LLMs. The prototype was therefore scoped around prospecting activity and user-controlled accounts rather than sensitive internal data.

### Desired Outcome

When I asked what a better version of the workflow would look like, the answer was not “more AI.”

It was more visibility and less reconstruction.

The salesperson wanted:

- A clear list of people requiring follow-up
- Visibility into the last email or call
- A way to see who had responded
- Help identifying gaps in activity
- Clear next steps
- A workflow that made it easier to protect time for prospecting

Those findings became the basis for the application requirements.

---

## What the Application Does

The application allows a user to:

- Sign in with Google
- Create and manage prospect records
- Enroll prospects in outreach sequences
- Draft outreach messages with AI assistance
- Review and edit messages before sending
- Send email through the user’s connected Gmail account
- Track activity through a live dashboard
- Manually confirm call completion
- Pause or skip sequence activity
- Keep user records isolated through Firestore access controls

---

## Human-in-the-Loop Design

The application automates administrative and repeatable work while keeping consequential decisions with the user.

### Functional Split

| Work Category | Operational Focus | Examples |
| :--- | :--- | :--- |
| **Automate** | Repetitive, rules-based, administrative tasks | Workflow tracking, prospect record updates, sequence progression, activity state, dashboard updates |
| **AI + Human** | Tasks where AI accelerates work but human context matters | Message drafting, content refinement, outreach assistance |
| **Human** | Actions where judgment and accountability remain explicit | Final message approval, confirming call completion, deciding whether to pause, skip, or continue outreach |

### Principles in Action

- AI can assist with drafting, but the user reviews the message before it is sent.
- Call steps are tracked, but the user must confirm that the call occurred.
- Sequences can be paused or skipped at any point.
- Outreach remains visible and interruptible rather than operating as an opaque autonomous process.

The objective was not maximum automation. It was to remove friction while preserving judgment, accountability, and user control. This approach helped determine where AI added value and where it would create unnecessary risk or complexity.

---

## Architecture

### System Architecture

[ React + TypeScript Frontend ]
             │
             ├── (Real-time Sync) ──► [ Cloud Firestore ] ◄── Security Rules (`firestore.rules`)
             │
             ▼
[ Express API Gateway ]
   ├── Auth        ──► Firebase / Google OAuth
   ├── Generative  ──► Gemini API
   └── Mail        ──► Gmail API (Primary) ──(Fallback)──► Resend API

### Front End

The front end is built with React and TypeScript.

It uses:

- React Router for navigation
- Firebase Authentication for Google sign-in
- Real-time Firestore listeners for live dashboard updates
- Tailwind CSS for interface styling

### Back End

A small Express server handles outbound email and external-service interactions.

For email delivery, the server attempts to use the user’s connected Gmail account first.

It also handles known integration failure modes, including:

- Expired authentication
- Missing Gmail authorization
- Gmail API configuration issues

Instead of returning raw provider errors, the application returns messages intended to help the user understand what happened and what action may be required.

A transactional email provider can be used as a fallback when Gmail sending is unavailable.

### Data and Access Control

Firestore stores application records and supports real-time updates.

Security rules are designed to:

- Restrict users to their own records
- Validate required fields and data types
- Reject invalid writes
- Default-deny access that has not been explicitly permitted

See [`firestore.rules`](./firestore.rules).

---

## APIs and External Services

The application connects multiple systems rather than treating AI as a standalone feature.

The current architecture includes:

- Google Authentication
- Gmail API
- Gemini API
- Firebase Authentication
- Cloud Firestore
- Resend
- Express application logic coordinating external-service calls

Building the workflow required thinking about authentication, permissions, data movement, external dependencies, and failure states in addition to the AI component itself.

---

## AI as Part of the Workflow

AI is one component of the application, not the application itself.

The model assists with content generation while the surrounding system handles:

- Authentication
- Prospect data
- Sequence state
- Activity tracking
- User review
- Email delivery
- Error handling

This allows AI to support work inside the broader process rather than forcing the user to manually move information between an LLM and the systems where the work actually happens.

---

## Key Design Decisions

- **Solve the Workflow, Not the Entire Category:** The goal was not to recreate Outreach, Salesloft, or another enterprise sales-engagement platform. The prototype focuses on the capabilities the user actually needed and intentionally leaves out functionality that was not necessary to validate the workflow.
- **Start With the User, Not the Technology:** The application requirements came from workflow discovery rather than beginning with a predetermined AI solution. The process was: *Understand the work → identify friction → determine where automation or AI helps → connect the necessary systems → preserve human control.*
- **Design for Failure:** External integrations are not always reliable. Tokens expire. Permissions change. APIs may not be enabled or available. The application therefore handles known failure states rather than assuming every external call will succeed.
- **Keep the System Interruptible:** The user can review, pause, skip, and correct activity. Automation supports the salesperson rather than removing her ability to intervene.

---

## What I Learned

- **Workflow Understanding Comes Before AI Selection:** The useful question was not *"Where can I add AI?"* It was *"Where is this person losing time or capability, and what combination of software, automation, AI, and human judgment would improve that?"*
- **Integration Work Matters as Much as the Model:** The LLM is only one part of the system. Authentication, APIs, permissions, application state, error handling, and user experience determine whether an AI capability is actually usable.
- **Adoption Depends on Trust and Control:** For a workflow involving communication with real prospects, greater autonomy is not automatically better. Making AI output reviewable and automation interruptible gives the user visibility into what the system is doing.
- **Prototyping Exposes Production Requirements:** Building the workflow made it easier to identify what would be required to make the application reliable, governable, and scalable for broader organizational use.

---

## Current Limitations

This is a working prototype built for one person’s actual workflow, not a production multi-tenant SaaS platform.

It does not currently include:

- Team or administrator visibility
- CRM integration
- Bulk data import or export
- Bounce and deliverability management
- Automated unsubscribe handling
- Sending-frequency controls
- Formal audit logging
- A documented data-retention policy
- Comprehensive automated testing
- Organization-level permissions and governance controls

---

## What I Would Add for Production

- **Identity and Access:** Role-based access, organization-level tenant separation, and more granular permissions.
- **Reliability and Observability:** Structured backend logging, monitoring and alerting, retry logic for external APIs, rate limiting, and provider-level failure visibility.
- **Governance:** Formal data-retention and deletion policies, audit logging, automated unsubscribe handling, sending-frequency safeguards, and documentation of what data is sent to external AI services.
- **Testing:** Enrollment logic tests, sequence-advancement tests, API failure-state tests, and authorization/access-control tests.
- **Integration:** CRM synchronization, contact import/export, administrative reporting, and additional email-provider support.

---

## Technology Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Express
- Google Gmail API
- Gemini API
- Resend

---

## Project Status

Working prototype built around a real user workflow.

The broader question behind the project was:

> **How can AI and automation be embedded into a business workflow in a way that reduces friction, connects the systems where work already happens, and keeps people responsible for decisions requiring judgment?**

*Note: This repository is intended as a portfolio case study and code sample. Credentials and deployment configuration for the original application are not included.*
