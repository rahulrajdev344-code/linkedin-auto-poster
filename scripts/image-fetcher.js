/**
 * Image Fetcher — gets images from actual article pages
 * 
 * Priority:
 * 1. Source imageUrl (Dev.to cover, Reddit image)
 * 2. Resolve real article URL via DuckDuckGo → scrape og:image
 * 3. Picsum fallback (last resort only)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Map common news sources to their domains
const SOURCE_DOMAINS = {
    'The Guardian': 'theguardian.com',
    'India Today': 'indiatoday.in',
    'The Times of India': 'timesofindia.indiatimes.com',
    'TechCrunch': 'techcrunch.com',
    'The Hindu': 'thehindu.com',
    'NDTV': 'ndtv.com',
    'Reuters': 'reuters.com',
    'BBC': 'bbc.com',
    'CNN': 'cnn.com',
    'Wired': 'wired.com',
    'The Verge': 'theverge.com',
    'Ars Technica': 'arstechnica.com',
    'Forbes': 'forbes.com',
    'Bloomberg': 'bloomberg.com',
    'Mint': 'livemint.com',
    'Economic Times': 'economictimes.indiatimes.com',
    'Business Standard': 'business-standard.com',
    'Hindustan Times': 'hindustantimes.com',
    'The Indian Express': 'indianexpress.com',
    'Moneycontrol': 'moneycontrol.com',
    'Business Insider': 'businessinsider.com',
    'The New York Times': 'nytimes.com',
    'Washington Post': 'washingtonpost.com',
    'Engadget': 'engadget.com',
    'ZDNet': 'zdnet.com',
    'VentureBeat': 'venturebeat.com',
    'MIT Technology Review': 'technologyreview.com',
};

/**
 * Find the real article URL using DuckDuckGo search
 * Google News URLs use JS redirects that fetch can't follow,
 * so we search for the article title on the source's website
 */
async function findRealArticleUrl(title, sourceName) {
    if (!title) return null;

    // Determine the source domain
    let domain = SOURCE_DOMAINS[sourceName];
    if (!domain) {
        // Guess from source name
        domain = sourceName?.toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, '') + '.com';
    }

    console.log(`🔍 Searching for real article URL on ${domain}...`);

    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(title + ' site:' + domain)}`;
        const res = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(5000),
        });
        const html = await res.text();

        // Extract first result URL (DDG encodes URLs)
        const resultMatch = html.match(/class="result__a"[^>]*href="([^"]+)"/);
        if (!resultMatch) {
            console.warn('⚠️ No search results found');
            return null;
        }

        const rawUrl = resultMatch[1];
        const realUrl = decodeURIComponent(rawUrl.replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]);
        console.log(`✅ Found real URL: ${realUrl.substring(0, 100)}...`);
        return realUrl;
    } catch (error) {
        console.warn(`⚠️ Search failed: ${error.message}`);
        return null;
    }
}

/**
 * Scrape og:image from a real article URL
 */
async function scrapeArticleImage(articleUrl) {
    if (!articleUrl) return null;

    console.log(`🖼️  Scraping og:image from: ${articleUrl.substring(0, 80)}...`);
    try {
        const response = await fetch(articleUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) {
            console.warn(`⚠️ Article page fetch failed (${response.status})`);
            return null;
        }

        const html = await response.text();

        // Try og:image first
        let imageUrl = null;
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

        if (ogMatch) {
            imageUrl = ogMatch[1];
            console.log(`✅ Found og:image: ${imageUrl.substring(0, 80)}...`);
        }

        // Try twitter:image as fallback
        if (!imageUrl) {
            const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
                || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
            if (twMatch) {
                imageUrl = twMatch[1];
                console.log(`✅ Found twitter:image: ${imageUrl.substring(0, 80)}...`);
            }
        }

        return imageUrl;
    } catch (error) {
        console.warn(`⚠️ Article scrape error: ${error.message}`);
        return null;
    }
}

/**
 * Fetch a fallback image from picsum.photos (only used as last resort)
 */
async function getFallbackImage(topic = 'technology') {
    const seed = encodeURIComponent(topic + Date.now());
    const url = `https://picsum.photos/seed/${seed}/1200/630`;

    console.log(`🖼️  Using fallback image (no article image found)`);
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Image API error: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const tmpPath = path.join(os.tmpdir(), `linkedin-image-${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buffer);

    console.log(`✅ Fallback image saved: ${tmpPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return { filePath: tmpPath, size: buffer.length, mimeType: 'image/jpeg' };
}

/**
 * Download an image from a URL
 */
async function downloadImage(imageUrl) {
    if (!imageUrl) return null;

    console.log(`🖼️  Downloading image: ${imageUrl.substring(0, 80)}...`);
    try {
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            console.warn(`⚠️ Image download failed (${response.status})`);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
            console.warn(`⚠️ URL is not an image (${contentType})`);
            return null;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length < 5000) {
            console.warn(`⚠️ Image too small (${buffer.length} bytes)`);
            return null;
        }

        const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
        const tmpPath = path.join(os.tmpdir(), `linkedin-image-${Date.now()}.${ext}`);
        fs.writeFileSync(tmpPath, buffer);

        console.log(`✅ Image downloaded: ${tmpPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
        return { filePath: tmpPath, size: buffer.length, mimeType: contentType };
    } catch (error) {
        console.warn(`⚠️ Image download error: ${error.message}`);
        return null;
    }
}

/**
 * Get an image for a post — priority order:
 * 1. Source imageUrl (from scraper, e.g. Dev.to cover_image, Reddit image)
 * 2. Find real article URL via DuckDuckGo → scrape og:image from source website
 * 3. Fallback to picsum.photos (last resort)
 */
async function getImageForPost(content) {
    // 1. Try the source image first (Dev.to cover, Reddit image, etc.)
    if (content.imageUrl) {
        const image = await downloadImage(content.imageUrl);
        if (image) return image;
    }

    // 2. Try to find real article URL and scrape og:image
    // Extract source name from title (Google News format: "Title - Source Name")
    const sourceName = content.sourceName
        || content.title?.match(/ - ([^-]+)$/)?.[1]?.trim()
        || '';
    const cleanTitle = content.title?.replace(/ - [^-]+$/, '') || content.title;

    if (cleanTitle && sourceName) {
        const realUrl = await findRealArticleUrl(cleanTitle, sourceName);
        if (realUrl) {
            const ogImageUrl = await scrapeArticleImage(realUrl);
            if (ogImageUrl) {
                const image = await downloadImage(ogImageUrl);
                if (image) return image;
            }
        }
    }

    // Also try direct URL if available and not a Google News redirect
    if (content.url && !content.url.includes('news.google.com')) {
        const ogImageUrl = await scrapeArticleImage(content.url);
        if (ogImageUrl) {
            const image = await downloadImage(ogImageUrl);
            if (image) return image;
        }
    }

    // 3. Last resort: picsum fallback
    try {
        return await getFallbackImage(content.topic || 'technology');
    } catch (error) {
        console.warn(`⚠️ Fallback image failed: ${error.message}`);
        return null;
    }
}

/**
 * Clean up temporary image file
 */
function cleanupImage(image) {
    if (image?.filePath) {
        try {
            fs.unlinkSync(image.filePath);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

module.exports = { getImageForPost, downloadImage, scrapeArticleImage, findRealArticleUrl, getFallbackImage, cleanupImage };
