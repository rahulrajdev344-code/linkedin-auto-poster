/**
 * Image Fetcher — gets images from actual article pages
 * Scrapes og:image from the article URL so images match the news content
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Scrape og:image from an article URL
 * This gets the REAL article image that matches the news content
 */
async function scrapeArticleImage(articleUrl) {
    if (!articleUrl) return null;

    console.log(`🖼️  Scraping article image from: ${articleUrl.substring(0, 80)}...`);
    try {
        const response = await fetch(articleUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            console.warn(`⚠️ Article page fetch failed (${response.status})`);
            return null;
        }

        const html = await response.text();

        // Try og:image first (most reliable for article images)
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

    console.log(`🖼️  Fetching fallback image (no article image found)`);
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
 * 1. Source imageUrl (from scraper, e.g. Dev.to cover_image)
 * 2. Scrape og:image from the article URL
 * 3. Fallback to picsum.photos (last resort)
 */
async function getImageForPost(content) {
    // 1. Try the source image first (Dev.to cover, Reddit image, etc.)
    if (content.imageUrl) {
        const image = await downloadImage(content.imageUrl);
        if (image) return image;
    }

    // 2. Try scraping og:image from the article URL
    if (content.url) {
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

// Allow running standalone
if (process.argv[1]?.endsWith('image-fetcher.js')) {
    const url = process.argv[2] || 'https://www.theguardian.com';
    scrapeArticleImage(url).then((img) => {
        console.log('OG Image:', img);
    }).catch(console.error);
}

module.exports = { getImageForPost, downloadImage, scrapeArticleImage, getFallbackImage, cleanupImage };
