## Running the Project Locally

### Install dependencies

```bash
npm install
```

### Configure Firebase

Add your Firebase project configuration to:

```text
firebase-applet-config.json
```

Placeholder values are included in this repository. Credentials from the original deployment are not included.

### Configure environment variables

Create a local `.env` file and add the required credentials.

```text
GEMINI_API_KEY=
RESEND_API_KEY=
```

Additional Google or Firebase configuration may be required depending on the environment.

### Start the application

```bash
npm run dev
```

---

## Project Status

Working prototype built around a real user workflow.
