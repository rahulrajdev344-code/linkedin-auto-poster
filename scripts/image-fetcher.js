/**
 * Image Fetcher — downloads images and provides fallback images from Unsplash
 * Used to attach images to LinkedIn posts
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Fetch a fallback image from Unsplash based on topic (free, no API key needed)
 * Uses Unsplash Source which redirects to a random image
 */
async function getUnsplashImage(topic = 'technology') {
    const query = encodeURIComponent(topic);
    const url = `https://source.unsplash.com/1200x630/?${query}`;

    console.log(`🖼️  Fetching Unsplash image for topic: "${topic}"`);
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Unsplash error: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const tmpPath = path.join(os.tmpdir(), `linkedin-image-${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buffer);

    console.log(`✅ Image saved: ${tmpPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
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
            headers: { 'User-Agent': 'LinkedInPoster/1.0' },
            redirect: 'follow',
        });

        if (!response.ok) {
            console.warn(`⚠️ Image download failed (${response.status}), will use fallback`);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
            console.warn(`⚠️ URL is not an image (${contentType}), will use fallback`);
            return null;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Skip very small images (likely thumbnails/icons)
        if (buffer.length < 5000) {
            console.warn(`⚠️ Image too small (${buffer.length} bytes), will use fallback`);
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
 * Get an image for a post — tries source image first, falls back to Unsplash
 */
async function getImageForPost(content) {
    // Try the source image first
    if (content.imageUrl) {
        const image = await downloadImage(content.imageUrl);
        if (image) return image;
    }

    // Fallback to Unsplash
    try {
        return await getUnsplashImage(content.topic || 'technology');
    } catch (error) {
        console.warn(`⚠️ Unsplash fallback failed: ${error.message}`);
        return null; // Post will be text-only
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
    const topic = process.argv[2] || 'technology';
    getUnsplashImage(topic).then(console.log).catch(console.error);
}

module.exports = { getImageForPost, downloadImage, getUnsplashImage, cleanupImage };
