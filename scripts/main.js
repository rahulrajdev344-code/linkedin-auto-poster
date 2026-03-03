/**
 * Main Orchestrator — ties scraping, AI rewriting, image fetching, and LinkedIn posting together
 *
 * Usage:
 *   node scripts/main.js            # Full run: scrape → rewrite → fetch image → post
 *   node scripts/main.js --dry-run  # Test without posting to LinkedIn
 */

const { scrapeContent } = require('./scraper');
const { rewriteContent } = require('./ai-rewriter');
const { postToLinkedIn, uploadImageToLinkedIn, verifyToken } = require('./linkedin-poster');
const { getImageForPost, cleanupImage } = require('./image-fetcher');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log('🚀 LinkedIn Auto-Poster starting...');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`🔧 Mode: ${isDryRun ? 'DRY RUN (no posting)' : 'LIVE'}`);
    console.log('─'.repeat(50));

    let image = null;

    try {
        // Step 1: Verify LinkedIn token (skip in dry-run)
        if (!isDryRun) {
            console.log('\n🔐 Step 1: Verifying LinkedIn token...');
            await verifyToken();
        } else {
            console.log('\n🔐 Step 1: Skipping token verification (dry run)');
        }

        // Step 2: Scrape content from a random free source
        console.log('\n📰 Step 2: Scraping content...');
        const content = await scrapeContent();
        console.log(`   Source: ${content.source}`);
        console.log(`   Title: ${content.title?.substring(0, 80)}`);
        console.log(`   Image: ${content.imageUrl ? 'Yes ✅' : 'No (will use fallback)'}`);

        // Step 3: Rewrite with AI
        console.log('\n🤖 Step 3: Rewriting with AI...');
        const rewritten = await rewriteContent(content);

        console.log('\n📝 Generated Post:');
        console.log('─'.repeat(50));
        console.log(rewritten.text);
        console.log('─'.repeat(50));
        console.log(`   Style: ${rewritten.style}`);
        console.log(`   Length: ${rewritten.text.length} chars`);

        // Step 4: Fetch image
        console.log('\n🖼️  Step 4: Fetching image...');
        image = await getImageForPost(content);
        if (image) {
            console.log(`   Image: ${image.filePath} (${(image.size / 1024).toFixed(1)} KB)`);
        } else {
            console.log('   No image available — posting text-only');
        }

        // Step 5: Post to LinkedIn
        if (isDryRun) {
            console.log('\n✅ DRY RUN complete — post was NOT sent to LinkedIn');
            console.log(`   Would post: ${image ? 'with image 📸' : 'text-only 📝'}`);
            console.log('   Run without --dry-run to post for real');
        } else {
            console.log('\n📤 Step 5: Posting to LinkedIn...');

            let imageAssetUrn = null;

            // Upload image if available
            if (image) {
                try {
                    imageAssetUrn = await uploadImageToLinkedIn(image.filePath);
                } catch (imgErr) {
                    console.warn(`⚠️ Image upload failed: ${imgErr.message}`);
                    console.log('   Falling back to text-only post...');
                }
            }

            const result = await postToLinkedIn(rewritten.text, imageAssetUrn);
            console.log(`   Post ID: ${result.postId}`);
            console.log(`   Has Image: ${result.hasImage ? 'Yes 📸' : 'No 📝'}`);
            console.log(`   Timestamp: ${result.timestamp}`);
        }

        console.log('\n🎉 Done!');
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    } finally {
        // Clean up temporary image file
        cleanupImage(image);
    }
}

main();
