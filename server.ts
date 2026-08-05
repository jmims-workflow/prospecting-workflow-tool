import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
let db: Firestore;
let firebaseConfig: any;
try {
  const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

  // TOTAL ISOLATION: Clear any environment variables that might confuse the SDK
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GCLOUD_PROJECT;

  // Initialize a NAMED Firebase App to avoid collisions and force explicit config
  const appName = 'outreach-app';
  const adminApp = getApps().find(a => a.name === appName) || initializeApp({
    projectId: firebaseConfig.projectId,
  }, appName);
  
  // Use the explicit Firestore constructor with the correct project and database
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  db = getFirestore(adminApp, dbId);
  
  console.log(`Firestore TOTAL ISOLATION: Project=${firebaseConfig.projectId}, Database=${dbId}`);
} catch (err) {
  console.error('CRITICAL: Firebase Admin initialization failed:', err);
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const expressApp = express();
  const PORT = 3000;

  expressApp.use(express.json());

  // Request logging middleware
  expressApp.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Simple ping route
  expressApp.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Diagnostic endpoint to test Firestore connectivity
  expressApp.get('/api/diag', async (req, res) => {
    console.log('Diagnostic route /api/diag hit');
    try {
      if (!db) throw new Error('Firestore not initialized');
      
      console.log('Running Firestore diagnostic...');
      
      // 1. List collections
      const collections = await db.listCollections();
      
      // 2. Try a simple write
      const testRef = db.collection('_debug_').doc('test');
      await testRef.set({ 
        timestamp: new Date().toISOString(),
        message: 'Diagnostic test'
      });
      
      // 3. Try a simple read
      const testDoc = await testRef.get();
      
      res.json({ 
        status: 'ok', 
        projectId: firebaseConfig.projectId,
        databaseId: (db as any)._databaseId || 'unknown',
        collections: collections.map(c => c.id),
        testDocExists: testDoc.exists,
        envProject: process.env.GOOGLE_CLOUD_PROJECT || 'auto-discovered'
      });
    } catch (err: any) {
      console.error('Firebase Diagnostic Error:', err);
      res.status(500).json({ 
        status: 'error', 
        message: err.message,
        code: err.code,
        details: err.details,
        projectId: firebaseConfig?.projectId,
        databaseId: (db as any)?._databaseId
      });
    }
  });

  // API Route to check config status
  expressApp.get('/api/config-status', (req, res) => {
    res.json({
      resendConfigured: !!process.env.RESEND_API_KEY,
    });
  });

  // API Route to test Gmail connection
  expressApp.post('/api/test-gmail', async (req, res) => {
    const { googleAccessToken } = req.body;
    if (!googleAccessToken) return res.status(400).json({ error: 'Missing token' });

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: googleAccessToken });
      const gmail = google.gmail({ version: 'v1', auth });

      const messageParts = [
        'To: me',
        'Subject: Gmail Connection Test',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Your Gmail connection is working perfectly! You can now send outreach sequences.',
      ];
      const message = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error('Gmail Test Error:', err);
      let errorMessage = err instanceof Error ? err.message : String(err);
      
      // Check for "API not enabled" error and provide the link
      if (errorMessage.includes('Gmail API has not been used')) {
        const projectMatch = errorMessage.match(/project (\d+)/);
        const projectId = projectMatch ? projectMatch[1] : '127351756843';
        errorMessage = `Gmail API is not enabled. Please enable it here: https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${projectId}`;
      } else if (err.code === 401 || errorMessage.toLowerCase().includes('invalid authentication credentials') || errorMessage.toLowerCase().includes('expired')) {
        errorMessage = 'Gmail session expired. Please Reconnect Gmail in Settings.';
      }
      
      res.status(500).json({ error: `Gmail API Error: ${errorMessage} (Code: ${err.code || 'unknown'})` });
    }
  });

  // API Route to send email (Client handles Firestore data)
  expressApp.post('/api/send-email', async (req, res) => {
    const { to, subject, body, googleAccessToken } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing to, subject, or body' });
    }

    try {
      if (googleAccessToken) {
        console.log(`Attempting to send email via Gmail API to ${to}...`);
        console.log(`Token length: ${googleAccessToken.length}, First 5 chars: ${googleAccessToken.substring(0, 5)}...`);
        try {
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: googleAccessToken });
          const gmail = google.gmail({ version: 'v1', auth });

          // Robust RFC 2822 message construction
          const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
          const messageParts = [
            `From: me`,
            `To: ${to}`,
            `Subject: ${utf8Subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            body,
          ];
          const message = messageParts.join('\r\n');
          const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const gmailRes = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage },
          });
          console.log('Email sent successfully via Gmail API:', gmailRes.data.id);
        } catch (gmailErr: any) {
          console.error('Gmail API Error Detail:', JSON.stringify(gmailErr, null, 2));
          let msg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr);
          
          // Check for "API not enabled" error and provide the link
          if (msg.includes('Gmail API has not been used')) {
            const projectMatch = msg.match(/project (\d+)/);
            const projectId = projectMatch ? projectMatch[1] : '127351756843';
            msg = `Gmail API is not enabled. Please enable it here: https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${projectId}`;
          } else if (gmailErr.code === 401 || msg.toLowerCase().includes('invalid authentication credentials') || msg.toLowerCase().includes('expired')) {
            msg = 'Gmail session expired. Please Reconnect Gmail in Settings.';
          }
          
          throw new Error(`Gmail API Error: ${msg} (Code: ${gmailErr.code || 'unknown'})`);
        }
      } else {
        console.log(`Attempting to send email via Resend to ${to}...`);
        let resendClient = resend;
        if (!resendClient && process.env.RESEND_API_KEY) {
          resendClient = new Resend(process.env.RESEND_API_KEY);
        }

        if (!resendClient) {
          return res.status(500).json({ error: 'RESEND_API_KEY is not configured and Gmail is not connected.' });
        }

        const { data, error } = await resendClient.emails.send({
          from: 'Outreach <onboarding@resend.dev>',
          to: to,
          subject: subject,
          text: body,
        });

        if (error) {
          console.error('Resend API Error:', JSON.stringify(error, null, 2));
          return res.status(500).json({ error: `Resend Error: ${error.message}` });
        }
        console.log('Email sent successfully via Resend:', data?.id);
      }

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (err) {
      console.error('Email sending failed:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // API Route to execute an action (Legacy/Fallback - will likely fail due to permissions)
  expressApp.post('/api/execute-action', async (req, res) => {
    res.status(403).json({ error: 'This route is deprecated. Use /api/send-email instead.' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

