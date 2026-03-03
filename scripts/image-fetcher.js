/**
 * Image Fetcher — gets images directly from the source news website
 * 
 * How it works for Google News articles:
 * 1. Search the article title on the source's website via DuckDuckGo
 * 2. Find the real article URL (NDTV, Guardian, India Today etc.)
 * 3. Scrape og:image from the actual article page
 * 4. Download and upload the real image to LinkedIn
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
    'Firstpost': 'firstpost.com',
    'News18': 'news18.com',
    'Zee News': 'zeenews.india.com',
    'Republic World': 'republicworld.com',
    'Deccan Herald': 'deccanherald.com',
    'Scroll.in': 'scroll.in',
    'The Wire': 'thewire.in',
    'Gadgets 360': 'gadgets360.com',
    'Inc42': 'inc42.com',
};

/**
 * Find the real article URL using Bing search (lighter than DuckDuckGo).
 * Google News article URLs use JS redirects, so we search for the article by title
 * to find the original URL on the source website (NDTV, Guardian, etc.).
 */
async function findRealArticleUrl(title, sourceName) {
    if (!title) return null;

    let domain = SOURCE_DOMAINS[sourceName];
    if (!domain) {
        domain = sourceName?.toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, '') + '.com';
    }

    console.log(`🔍 Searching for article on ${domain}...`);

    // Use a short version of the title to get better results
    const shortTitle = title.split(' ').slice(0, 10).join(' ');

    try {
        // Use Bing search (lighter response than DuckDuckGo)
        const query = encodeURIComponent(`${shortTitle} site:${domain}`);
        const searchUrl = `https://www.bing.com/search?q=${query}&count=3`;
        const res = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            signal: AbortSignal.timeout(5000),
        });

        // Read only first 50KB to avoid memory issues
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let html = '';
        while (html.length < 50000) {
            const { done, value } = await reader.read();
            if (done) break;
            html += decoder.decode(value, { stream: true });
        }
        reader.cancel();

        // Extract URLs that match the source domain
        const urlPattern = new RegExp(`https?://(?:www\\.)?${domain.replace(/\./g, '\\.')}[^"\\s<>]+`, 'gi');
        const foundUrls = [...new Set(html.match(urlPattern) || [])];

        // Filter out search/nav URLs, keep article URLs
        const articleUrl = foundUrls.find(u =>
            u.length > 40 && !u.includes('/search') && !u.includes('/tag/') && !u.includes('/topics/')
        );

        if (articleUrl) {
            console.log(`✅ Found real URL: ${articleUrl.substring(0, 100)}`);
            return articleUrl;
        }

        // Fallback: try without site: restriction
        console.log('🔍 Retrying with broader search...');
        const query2 = encodeURIComponent(`${shortTitle} ${sourceName}`);
        const res2 = await fetch(`https://www.bing.com/search?q=${query2}&count=3`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            signal: AbortSignal.timeout(5000),
        });

        let html2 = '';
        const reader2 = res2.body.getReader();
        while (html2.length < 50000) {
            const { done, value } = await reader2.read();
            if (done) break;
            html2 += decoder.decode(value, { stream: true });
        }
        reader2.cancel();

        const foundUrls2 = [...new Set(html2.match(urlPattern) || [])];
        const articleUrl2 = foundUrls2.find(u => u.length > 40 && !u.includes('/search'));

        if (articleUrl2) {
            console.log(`✅ Found real URL: ${articleUrl2.substring(0, 100)}`);
            return articleUrl2;
        }

        console.warn('⚠️ Could not find real article URL');
        return null;
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) return null;

        // Only read first 20KB (og:image is always in the <head>)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let html = '';
        while (html.length < 20000) {
            const { done, value } = await reader.read();
            if (done) break;
            html += decoder.decode(value, { stream: true });
        }
        reader.cancel();

        // Try og:image
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogMatch) {
            console.log(`✅ Found og:image: ${ogMatch[1].substring(0, 80)}...`);
            return ogMatch[1];
        }

        // Try twitter:image
        const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
        if (twMatch) {
            console.log(`✅ Found twitter:image: ${twMatch[1].substring(0, 80)}...`);
            return twMatch[1];
        }

        return null;
    } catch (error) {
        console.warn(`⚠️ Article scrape error: ${error.message}`);
        return null;
    }
}

/**
 * Download an image from a URL
 */
async function downloadImage(imageUrl) {
    if (!imageUrl) return null;

    console.log(`🖼️  Downloading image: ${imageUrl.substring(0, 80)}...`);
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 5000) return null;

        const ext = contentType.includes('png') ? 'png' : 'jpg';
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
 * Fallback image from picsum.photos (last resort only)
 */
async function getFallbackImage(topic = 'technology') {
    console.log(`🖼️  Using fallback image (no article image found)`);
    const url = `https://picsum.photos/seed/${encodeURIComponent(topic + Date.now())}/1200/630`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Image API error: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const tmpPath = path.join(os.tmpdir(), `linkedin-image-${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buffer);
    return { filePath: tmpPath, size: buffer.length, mimeType: 'image/jpeg' };
}

/**
 * Get image for a post:
 * 1. Source imageUrl (Dev.to cover, Reddit image)
 * 2. Search for real article → scrape og:image from source website
 * 3. Picsum fallback (last resort)
 */
async function getImageForPost(content) {
    // 1. Direct source image
    if (content.imageUrl) {
        const image = await downloadImage(content.imageUrl);
        if (image) return image;
    }

    // 2. Find real article and scrape image from source website
    const sourceName = content.sourceName || content.title?.match(/ - ([^-]+)$/)?.[1]?.trim() || '';
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

    // Try direct URL if not a Google News link
    if (content.url && !content.url.includes('news.google.com')) {
        const ogImageUrl = await scrapeArticleImage(content.url);
        if (ogImageUrl) {
            const image = await downloadImage(ogImageUrl);
            if (image) return image;
        }
    }

    // 3. Fallback
    try {
        return await getFallbackImage(content.topic || 'technology');
    } catch (e) {
        return null;
    }
}

function cleanupImage(image) {
    if (image?.filePath) { try { fs.unlinkSync(image.filePath); } catch (e) { } }
}

module.exports = { getImageForPost, downloadImage, scrapeArticleImage, findRealArticleUrl, getFallbackImage, cleanupImage };
