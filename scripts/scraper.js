/**
 * Content Scraper — scrapes trending content from multiple free sources
 *
 * Sources (all free, no API key needed):
 * - Dev.to          → Tech articles with cover images
 * - Hacker News     → Top tech stories
 * - Reddit          → Multiple subreddits (tech, finance, motivation)
 * - Medium (RSS)    → Trending blog articles
 * - ProductHunt     → New product launches
 * - Inc42 (RSS)     → Indian startup news & infographics
 * - Google Trends   → Trending topics
 * - Quotes          → Inspirational quotes
 */

const SOURCES = {
    DEVTO: 'devto',
    HACKERNEWS: 'hackernews',
    REDDIT: 'reddit',
    MEDIUM: 'medium',
    PRODUCTHUNT: 'producthunt',
    INC42: 'inc42',
    GOOGLE_TRENDS: 'google_trends',
    QUOTES: 'quotes',
};

// ─────────────────────────────────────────────
// Dev.to — Tech articles with cover images
// ─────────────────────────────────────────────
async function scrapeDevTo() {
    const response = await fetch('https://dev.to/api/articles?top=1&per_page=10');
    if (!response.ok) throw new Error(`Dev.to API error: ${response.status}`);

    const articles = await response.json();
    const article = articles[Math.floor(Math.random() * Math.min(articles.length, 10))];

    return {
        title: article.title,
        summary: article.description || article.title,
        url: article.url,
        imageUrl: article.cover_image || article.social_image || null,
        topic: article.tag_list?.[0] || 'technology',
        author: article.user?.name || 'Unknown',
        source: 'Dev.to',
        tags: article.tag_list || [],
    };
}

// ─────────────────────────────────────────────
// Hacker News — Top tech stories
// ─────────────────────────────────────────────
async function scrapeHackerNews() {
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topRes.ok) throw new Error(`HN API error: ${topRes.status}`);

    const topIds = await topRes.json();
    const storyId = topIds[Math.floor(Math.random() * Math.min(topIds.length, 15))];

    const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
    const story = await storyRes.json();

    return {
        title: story.title,
        summary: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        imageUrl: null,
        topic: 'technology',
        author: story.by || 'Unknown',
        source: 'Hacker News',
        tags: ['tech', 'startups', 'programming'],
    };
}

// ─────────────────────────────────────────────
// Reddit — Multiple subreddits (tech, finance, motivation)
// ─────────────────────────────────────────────
async function scrapeReddit() {
    const subreddits = [
        'programming', 'technology', 'webdev', 'learnprogramming', 'datascience',
        'artificial', 'startups', 'entrepreneur', 'productivity', 'getmotivated',
        'investing', 'personalfinance', 'careerguidance', 'cscareerquestions',
    ];
    const subreddit = subreddits[Math.floor(Math.random() * subreddits.length)];

    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=10`, {
        headers: { 'User-Agent': 'LinkedInPoster/1.0' },
    });
    if (!response.ok) throw new Error(`Reddit API error: ${response.status}`);

    const data = await response.json();
    const posts = data.data.children.filter(
        (p) => !p.data.stickied && p.data.selftext !== '[removed]'
    );
    const post = posts[Math.floor(Math.random() * Math.min(posts.length, 8))];

    let imageUrl = null;
    if (post.data.post_hint === 'image') {
        imageUrl = post.data.url;
    } else if (post.data.thumbnail && post.data.thumbnail.startsWith('http')) {
        imageUrl = post.data.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || null;
    }

    return {
        title: post.data.title,
        summary: post.data.selftext?.substring(0, 300) || post.data.title,
        url: `https://reddit.com${post.data.permalink}`,
        imageUrl,
        topic: subreddit,
        author: post.data.author || 'Unknown',
        source: `Reddit r/${subreddit}`,
        tags: [subreddit, 'tech'],
    };
}

// ─────────────────────────────────────────────
// Medium — Trending articles via RSS (free, no API key)
// ─────────────────────────────────────────────
async function scrapeMedium() {
    const topics = ['technology', 'artificial-intelligence', 'programming', 'startup',
        'productivity', 'self-improvement', 'data-science', 'leadership'];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    // Use RSS2JSON free API to convert Medium RSS to JSON
    const rssUrl = encodeURIComponent(`https://medium.com/feed/tag/${topic}`);
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    if (!response.ok) throw new Error(`Medium RSS error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'ok' || !data.items?.length) throw new Error('No Medium articles found');

    const article = data.items[Math.floor(Math.random() * Math.min(data.items.length, 8))];

    // Extract first image from content if available
    const imgMatch = article.description?.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = article.thumbnail || (imgMatch ? imgMatch[1] : null);

    // Clean HTML tags from description
    const cleanDesc = article.description?.replace(/<[^>]*>/g, '').substring(0, 300) || article.title;

    return {
        title: article.title,
        summary: cleanDesc,
        url: article.link,
        imageUrl,
        topic,
        author: article.author || 'Unknown',
        source: 'Medium',
        tags: [topic, 'medium', 'blog'],
    };
}

// ─────────────────────────────────────────────
// ProductHunt — New product launches (free API)
// ─────────────────────────────────────────────
async function scrapeProductHunt() {
    // ProductHunt has a public RSS feed
    const rssUrl = encodeURIComponent('https://www.producthunt.com/feed');
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    if (!response.ok) throw new Error(`ProductHunt RSS error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'ok' || !data.items?.length) throw new Error('No PH items found');

    const item = data.items[Math.floor(Math.random() * Math.min(data.items.length, 8))];

    // Extract image from content
    const imgMatch = item.description?.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = item.thumbnail || (imgMatch ? imgMatch[1] : null);

    const cleanDesc = item.description?.replace(/<[^>]*>/g, '').substring(0, 300) || item.title;

    return {
        title: item.title,
        summary: cleanDesc,
        url: item.link,
        imageUrl,
        topic: 'product-launch',
        author: item.author || 'Product Hunt',
        source: 'ProductHunt',
        tags: ['productlaunch', 'startup', 'tech', 'innovation'],
    };
}

// ─────────────────────────────────────────────
// Inc42 — Indian startup news & infographics (RSS)
// ─────────────────────────────────────────────
async function scrapeInc42() {
    const rssUrl = encodeURIComponent('https://inc42.com/feed/');
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    if (!response.ok) throw new Error(`Inc42 RSS error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'ok' || !data.items?.length) throw new Error('No Inc42 articles found');

    const article = data.items[Math.floor(Math.random() * Math.min(data.items.length, 8))];

    const imgMatch = article.description?.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = article.thumbnail || (imgMatch ? imgMatch[1] : null);

    const cleanDesc = article.description?.replace(/<[^>]*>/g, '').substring(0, 300) || article.title;

    return {
        title: article.title,
        summary: cleanDesc,
        url: article.link,
        imageUrl,
        topic: 'startups',
        author: article.author || 'Inc42',
        source: 'Inc42',
        tags: ['startup', 'india', 'business', 'funding'],
    };
}

// ─────────────────────────────────────────────
// Google Trends — Trending topics (RSS)
// ─────────────────────────────────────────────
async function scrapeGoogleTrends() {
    const rssUrl = encodeURIComponent('https://trends.google.com/trending/rss?geo=IN');
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    if (!response.ok) throw new Error(`Google Trends RSS error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'ok' || !data.items?.length) throw new Error('No trends found');

    const trend = data.items[Math.floor(Math.random() * Math.min(data.items.length, 10))];

    // Extract image from trend news
    const imgMatch = trend.description?.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    const cleanDesc = trend.description?.replace(/<[^>]*>/g, '').substring(0, 300) || trend.title;

    return {
        title: `Trending: ${trend.title}`,
        summary: cleanDesc || `${trend.title} is trending right now`,
        url: trend.link || '',
        imageUrl,
        topic: 'trending',
        author: 'Google Trends',
        source: 'Google Trends',
        tags: ['trending', 'news', 'viral'],
    };
}

// ─────────────────────────────────────────────
// Quotes — Inspirational quotes (free API)
// ─────────────────────────────────────────────
async function scrapeQuote() {
    const response = await fetch('https://api.quotable.io/quotes/random');
    if (!response.ok) throw new Error(`Quotable API error: ${response.status}`);

    const [quote] = await response.json();

    return {
        title: quote.content,
        summary: `"${quote.content}" — ${quote.author}`,
        url: '',
        imageUrl: null,
        topic: quote.tags?.[0] || 'motivation',
        author: quote.author,
        source: 'Quote',
        tags: quote.tags || ['motivation', 'inspiration'],
    };
}

// ─────────────────────────────────────────────
// Main scraper — weighted random source selection
// ─────────────────────────────────────────────
async function scrapeContent(preferredSource = null) {
    const sources = [
        { name: SOURCES.DEVTO, fn: scrapeDevTo, weight: 3 },
        { name: SOURCES.HACKERNEWS, fn: scrapeHackerNews, weight: 2 },
        { name: SOURCES.REDDIT, fn: scrapeReddit, weight: 3 },
        { name: SOURCES.MEDIUM, fn: scrapeMedium, weight: 3 },
        { name: SOURCES.PRODUCTHUNT, fn: scrapeProductHunt, weight: 2 },
        { name: SOURCES.INC42, fn: scrapeInc42, weight: 2 },
        { name: SOURCES.GOOGLE_TRENDS, fn: scrapeGoogleTrends, weight: 2 },
        { name: SOURCES.QUOTES, fn: scrapeQuote, weight: 1 },
    ];

    if (preferredSource) {
        const source = sources.find((s) => s.name === preferredSource);
        if (source) {
            console.log(`📰 Scraping from: ${source.name}`);
            return await source.fn();
        }
    }

    // Weighted random selection with fallback chain
    const weighted = sources.flatMap((s) => Array(s.weight).fill(s));
    const shuffled = weighted.sort(() => Math.random() - 0.5);

    for (const source of shuffled) {
        try {
            console.log(`📰 Trying source: ${source.name}`);
            const result = await source.fn();
            console.log(`✅ Got content: "${result.title?.substring(0, 60)}..."`);
            return result;
        } catch (error) {
            console.warn(`⚠️ ${source.name} failed: ${error.message}. Trying next...`);
        }
    }

    throw new Error('All content sources failed!');
}

// Allow running standalone
if (process.argv[1]?.endsWith('scraper.js')) {
    const source = process.argv[2] || null;
    scrapeContent(source)
        .then((content) => {
            console.log('\n📋 Scraped Content:');
            console.log(JSON.stringify(content, null, 2));
        })
        .catch(console.error);
}

module.exports = { scrapeContent, SOURCES };
