/**
 * Main Orchestrator — ties scraping, AI rewriting, and LinkedIn posting together
 *
 * Usage:
 *   node scripts/main.js            # Full run: scrape → rewrite → post
 *   node scripts/main.js --dry-run  # Test without posting to LinkedIn
 */

const { scrapeContent } = require('./scraper');
const { rewriteContent } = require('./ai-rewriter');
const { postToLinkedIn, verifyToken } = require('./linkedin-poster');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log('🚀 LinkedIn Auto-Poster starting...');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`🔧 Mode: ${isDryRun ? 'DRY RUN (no posting)' : 'LIVE'}`);
    console.log('─'.repeat(50));

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

        // Step 3: Rewrite with AI
        console.log('\n🤖 Step 3: Rewriting with AI...');
        const rewritten = await rewriteContent(content);

        console.log('\n📝 Generated Post:');
        console.log('─'.repeat(50));
        console.log(rewritten.text);
        console.log('─'.repeat(50));
        console.log(`   Style: ${rewritten.style}`);
        console.log(`   Length: ${rewritten.text.length} chars`);

        // Step 4: Post to LinkedIn
        if (isDryRun) {
            console.log('\n✅ DRY RUN complete — post was NOT sent to LinkedIn');
            console.log('   Run without --dry-run to post for real');
        } else {
            console.log('\n📤 Step 4: Posting to LinkedIn...');
            const result = await postToLinkedIn(rewritten.text);
            console.log(`   Post ID: ${result.postId}`);
            console.log(`   Timestamp: ${result.timestamp}`);
        }

        console.log('\n🎉 Done!');
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

main();
