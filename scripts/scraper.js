/**
 * Content Scraper — scrapes trending content from free APIs
 * Sources: Dev.to, Hacker News, Reddit (public JSON), Quotable API
 */

const SOURCES = {
    DEVTO: 'devto',
    HACKERNEWS: 'hackernews',
    REDDIT: 'reddit',
    QUOTES: 'quotes',
};

/**
 * Scrape trending articles from Dev.to (completely free, no API key)
 */
async function scrapeDevTo() {
    const response = await fetch('https://dev.to/api/articles?top=1&per_page=10');
    if (!response.ok) throw new Error(`Dev.to API error: ${response.status}`);

    const articles = await response.json();
    const article = articles[Math.floor(Math.random() * Math.min(articles.length, 10))];

    return {
        title: article.title,
        summary: article.description || article.title,
        url: article.url,
        topic: article.tag_list?.[0] || 'technology',
        author: article.user?.name || 'Unknown',
        source: 'Dev.to',
        tags: article.tag_list || [],
    };
}

/**
 * Scrape top stories from Hacker News (completely free, no API key)
 */
async function scrapeHackerNews() {
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topRes.ok) throw new Error(`HN API error: ${topRes.status}`);

    const topIds = await topRes.json();
    // Pick a random story from top 15
    const storyId = topIds[Math.floor(Math.random() * Math.min(topIds.length, 15))];

    const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
    const story = await storyRes.json();

    return {
        title: story.title,
        summary: story.title, // HN stories don't have descriptions
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        topic: 'technology',
        author: story.by || 'Unknown',
        source: 'Hacker News',
        tags: ['tech', 'startups', 'programming'],
    };
}

/**
 * Scrape top posts from Reddit (public JSON, no API key needed)
 */
async function scrapeReddit() {
    const subreddits = ['programming', 'technology', 'webdev', 'learnprogramming', 'datascience'];
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

    return {
        title: post.data.title,
        summary: post.data.selftext?.substring(0, 300) || post.data.title,
        url: `https://reddit.com${post.data.permalink}`,
        topic: subreddit,
        author: post.data.author || 'Unknown',
        source: `Reddit r/${subreddit}`,
        tags: [subreddit, 'tech'],
    };
}

/**
 * Get an inspirational quote (completely free, no API key)
 */
async function scrapeQuote() {
    const response = await fetch('https://api.quotable.io/quotes/random');
    if (!response.ok) throw new Error(`Quotable API error: ${response.status}`);

    const [quote] = await response.json();

    return {
        title: quote.content,
        summary: `"${quote.content}" — ${quote.author}`,
        url: '',
        topic: quote.tags?.[0] || 'motivation',
        author: quote.author,
        source: 'Quote',
        tags: quote.tags || ['motivation', 'inspiration'],
    };
}

/**
 * Scrape content from a random source
 */
async function scrapeContent(preferredSource = null) {
    const sources = [
        { name: SOURCES.DEVTO, fn: scrapeDevTo, weight: 3 },
        { name: SOURCES.HACKERNEWS, fn: scrapeHackerNews, weight: 3 },
        { name: SOURCES.REDDIT, fn: scrapeReddit, weight: 2 },
        { name: SOURCES.QUOTES, fn: scrapeQuote, weight: 2 },
    ];

    // If preferred source is specified, use it
    if (preferredSource) {
        const source = sources.find((s) => s.name === preferredSource);
        if (source) {
            console.log(`📰 Scraping from: ${source.name}`);
            return await source.fn();
        }
    }

    // Weighted random selection
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
    scrapeContent()
        .then((content) => {
            console.log('\n📋 Scraped Content:');
            console.log(JSON.stringify(content, null, 2));
        })
        .catch(console.error);
}

module.exports = { scrapeContent, SOURCES };
