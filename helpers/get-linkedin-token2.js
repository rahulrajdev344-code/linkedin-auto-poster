/**
 * Simple LinkedIn OAuth2 Token Helper - outputs to file for clean capture
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.argv[2];
const CLIENT_SECRET = process.argv[3];
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'openid profile email w_member_social';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('Usage: node helpers/get-linkedin-token2.js CLIENT_ID CLIENT_SECRET');
  process.exit(1);
}

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `scope=${encodeURIComponent(SCOPES)}`;

console.log('Open this URL in your browser:');
console.log(authUrl);
console.log('Waiting for callback...');

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost:3000');

  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.searchParams.get('code');

    if (!code) {
      res.writeHead(400);
      res.end('No code received');
      server.close();
      return;
    }

    try {
      // Exchange code for token
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(JSON.stringify(tokenData));

      // Get profile
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json();
      const personUrn = `urn:li:person:${profile.sub}`;

      // Write to file for clean output
      const creds = {
        access_token: tokenData.access_token,
        person_urn: personUrn,
        name: profile.name,
        expires_in_days: Math.round(tokenData.expires_in / 86400),
      };

      const outFile = path.join(__dirname, '..', 'credentials.json');
      fs.writeFileSync(outFile, JSON.stringify(creds, null, 2));
      console.log('SUCCESS! Credentials saved to credentials.json');
      console.log('Name:', profile.name);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Success! Check your terminal.</h1>');
    } catch (err) {
      console.error('Error:', err.message);
      res.writeHead(500);
      res.end('Error: ' + err.message);
    }

    server.close();
  }
});

server.listen(3000, () => console.log('Server ready on http://localhost:3000'));
