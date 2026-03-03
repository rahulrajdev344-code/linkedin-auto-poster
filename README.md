# 🚀 LinkedIn Auto-Poster (Free & Cloud-Based)

Automatically scrapes trending content from the web, rewrites it using free AI, and posts to LinkedIn — even while your laptop is off!

## 💰 Cost: $0

| Component | Service | Cost |
|---|---|---|
| Cloud Runner | GitHub Actions | Free (2,000 min/month) |
| Content Sources | Dev.to, Hacker News, Reddit, Quotes | Free (no API key) |
| AI Rewriting | Groq (Llama 3.3 70B) | Free tier |
| Posting | LinkedIn API | Free |

## ⚡ Quick Setup (10 minutes)

### 1. Get Groq API Key (Free)
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / log in
3. Create an API key → copy it

### 2. Create LinkedIn Developer App (Free)
1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
2. Click "Create App"
3. Fill in details (any company page works)
4. Under **Auth** tab:
   - Copy your **Client ID** and **Client Secret**
   - Add redirect URL: `http://localhost:3000/callback`
5. Under **Products** tab, request access to:
   - "Share on LinkedIn"
   - "Sign In with LinkedIn using OpenID Connect"

### 3. Get LinkedIn Access Token
```bash
npm install
node helpers/get-linkedin-token.js YOUR_CLIENT_ID YOUR_CLIENT_SECRET
```
Open the URL printed in your browser and authorize. Your token and person URN will be displayed.

### 4. Push to GitHub & Set Secrets
1. Create a GitHub repository
2. Push this code to it
3. Go to **Settings → Secrets → Actions** and add:
   - `LINKEDIN_ACCESS_TOKEN` — from step 3
   - `LINKEDIN_PERSON_URN` — from step 3 (format: `urn:li:person:XXXXX`)
   - `GROQ_API_KEY` — from step 1

### 5. Done! 🎉
GitHub Actions will automatically post to LinkedIn every 4 hours.

## 🧪 Test Locally

```bash
# Test the scraper
npm run scrape

# Test the full pipeline (without posting)
npm run dry-run

# Post for real
npm start
```

## 🔧 Customize

### Change posting frequency
Edit `.github/workflows/linkedin-poster.yml`:
```yaml
schedule:
  - cron: '0 */4 * * *'  # Every 4 hours
  # - cron: '0 9,17 * * *'  # Twice daily at 9am & 5pm UTC
  # - cron: '0 12 * * *'    # Once daily at noon UTC
```

### Add more content sources
Edit `scripts/scraper.js` to add new sources.

## ⚠️ Notes

- **Token Expiry**: LinkedIn tokens expire after ~60 days. Re-run the helper script to get a new one.
- **Rate Limits**: LinkedIn allows ~100 API calls per day. Posting every 4 hours = 6 posts/day (well within limits).
- **Content Quality**: The AI rewrites content in a personal style, but review posts occasionally to ensure quality.
