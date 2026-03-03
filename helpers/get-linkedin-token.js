/**
 * LinkedIn OAuth2 Token Helper
 *
 * Run this ONCE locally to get your LinkedIn access token.
 * You'll need a LinkedIn Developer App first.
 *
 * Steps:
 * 1. Go to https://www.linkedin.com/developers/apps
 * 2. Create an app (or use existing)
 * 3. Under "Auth", add redirect URL: http://localhost:3000/callback
 * 4. Note your Client ID and Client Secret
 * 5. Under "Products", request access to "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect"
 * 6. Run this script: node helpers/get-linkedin-token.js YOUR_CLIENT_ID YOUR_CLIENT_SECRET
 * 7. Open the URL printed in your browser
 * 8. After authorization, you'll get your access token and person URN
 */

const http = require('http');
const url = require('url');

const CLIENT_ID = process.argv[2];
const CLIENT_SECRET = process.argv[3];
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'openid profile email w_member_social';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log(`
╔══════════════════════════════════════════════════════╗
║         LinkedIn Access Token Helper                  ║
╠══════════════════════════════════════════════════════╣
║                                                        ║
║  Usage:                                                ║
║  node helpers/get-linkedin-token.js CLIENT_ID SECRET   ║
║                                                        ║
║  Steps to get Client ID & Secret:                      ║
║  1. Go to https://linkedin.com/developers/apps         ║
║  2. Create a new app                                   ║
║  3. Under Auth tab, copy Client ID & Client Secret     ║
║  4. Add redirect URL: http://localhost:3000/callback    ║
║  5. Under Products, request:                           ║
║     - "Share on LinkedIn"                              ║
║     - "Sign In with LinkedIn using OpenID Connect"     ║
║                                                        ║
╚══════════════════════════════════════════════════════╝
  `);
    process.exit(1);
}

// Generate authorization URL
const authUrl =
    `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(SCOPES)}`;

console.log('\n🔗 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n⏳ Waiting for callback...\n');

// Start local server to catch the callback
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Error: ${error}</h1><p>${parsedUrl.query.error_description}</p>`);
            server.close();
            return;
        }

        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>No authorization code received</h1>');
            server.close();
            return;
        }

        try {
            // Exchange code for access token
            console.log('🔄 Exchanging code for access token...');
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

            if (!tokenRes.ok) {
                throw new Error(JSON.stringify(tokenData));
            }

            // Get person URN
            console.log('🔄 Getting person URN...');
            const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const profile = await profileRes.json();
            const personUrn = `urn:li:person:${profile.sub}`;

            // Display results
            console.log('\n' + '═'.repeat(60));
            console.log('✅ SUCCESS! Here are your credentials:\n');
            console.log(`LINKEDIN_ACCESS_TOKEN=${tokenData.access_token}`);
            console.log(`LINKEDIN_PERSON_URN=${personUrn}`);
            console.log(`\nToken expires in: ${tokenData.expires_in} seconds (~${Math.round(tokenData.expires_in / 86400)} days)`);
            console.log(`Logged in as: ${profile.name}`);
            console.log('═'.repeat(60));
            console.log('\n📋 Add these as GitHub repository secrets:');
            console.log('   Settings → Secrets → Actions → New repository secret');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
        <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;text-align:center;">
          <h1>✅ Success!</h1>
          <p>Welcome, <strong>${profile.name}</strong></p>
          <p>Your credentials have been printed in the terminal.</p>
          <p>You can close this window.</p>
        </body></html>
      `);
        } catch (err) {
            console.error('❌ Error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Error</h1><pre>${err.message}</pre>`);
        }

        server.close();
    }
});

server.listen(3000, () => {
    console.log('🖥️  Local server listening on http://localhost:3000');
});
