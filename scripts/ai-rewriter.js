/**
 * AI Rewriter — rewrites scraped content into engaging LinkedIn posts
 * Uses Groq API (free tier, Llama 3.3 70B)
 *
 * Post styles based on real LinkedIn feed analysis:
 * - thought-leadership, storytelling, tips, hot-take, motivational
 * - product-discovery, data-insight, career-advice, trend-alert
 */

const Groq = require('groq-sdk');

const LINKEDIN_POST_STYLES = [
    'thought-leadership',
    'storytelling',
    'tips-and-advice',
    'hot-take',
    'motivational',
    'product-discovery',
    'data-insight',
    'career-advice',
    'trend-alert',
];

// Map content sources to their best-performing styles
const SOURCE_STYLE_MAP = {
    'Dev.to': ['thought-leadership', 'tips-and-advice', 'storytelling'],
    'Hacker News': ['hot-take', 'thought-leadership', 'trend-alert'],
    'Medium': ['storytelling', 'thought-leadership', 'tips-and-advice'],
    'ProductHunt': ['product-discovery', 'trend-alert', 'tips-and-advice'],
    'Inc42': ['data-insight', 'trend-alert', 'thought-leadership'],
    'Google Trends': ['trend-alert', 'hot-take', 'data-insight'],
    'Quote': ['motivational', 'storytelling', 'career-advice'],
};

/**
 * Build a prompt for the AI to rewrite content into a LinkedIn post
 */
function buildPrompt(content, style) {
    const basePrompt = `You are a LinkedIn content creator who writes viral, high-engagement posts. Rewrite the following content into an engaging LinkedIn post.

RULES:
- Write in first person, as if sharing your own thoughts/discovery
- Keep it under 1200 characters
- Use short paragraphs (1-2 sentences each)
- Start with a compelling hook (first line is crucial — it determines if people click "see more")
- Add line breaks between paragraphs for readability
- Include 3-5 relevant hashtags at the end
- Do NOT use markdown formatting (no **, ##, etc.)
- Do NOT include any URLs or links
- Sound authentic and personal, not robotic or corporate
- Add a call-to-action or question at the end to drive engagement
- Use emojis sparingly (1-3 max) for visual appeal`;

    const styleInstructions = {
        'thought-leadership':
            'Write as an industry expert sharing a unique insight or perspective. Open with a bold statement.',
        'storytelling':
            'Frame this as a personal story or experience. Start with "I just..." or "Last week I..." Use "I" statements throughout.',
        'tips-and-advice':
            'Present this as practical tips or actionable advice. Use numbered points. Start with "Here are X things I learned about..."',
        'hot-take':
            'Share a bold, slightly controversial opinion about this topic. Be provocative but professional. Start with an attention-grabbing statement.',
        'motivational':
            'Make this inspiring and uplifting. Connect it to personal growth or career development. End with encouragement.',
        'product-discovery':
            'Write as if you just discovered an amazing new tool/product. Start with "I just found this..." Be genuinely excited but not salesy.',
        'data-insight':
            'Share data or statistics from this content as if you analyzed them. Use numbers and percentages. Start with a surprising data point.',
        'career-advice':
            'Frame this as career advice for your network. Be genuine and helpful. Start with "One thing I wish someone told me..."',
        'trend-alert':
            'Present this as a breaking trend or shift in the industry. Create urgency. Start with "This is happening right now..."',
    };

    return `${basePrompt}

STYLE: ${styleInstructions[style] || styleInstructions['thought-leadership']}

CONTENT TO REWRITE:
Title: ${content.title}
Summary: ${content.summary}
Source Topic: ${content.topic}
Tags: ${content.tags?.join(', ') || 'general'}

Write ONLY the LinkedIn post text. Nothing else.`;
}

/**
 * Pick the best style based on content source
 */
function pickStyle(source) {
    // Try source-specific styles first
    for (const [key, styles] of Object.entries(SOURCE_STYLE_MAP)) {
        if (source?.includes(key)) {
            return styles[Math.floor(Math.random() * styles.length)];
        }
    }
    // Fall back to random style
    return LINKEDIN_POST_STYLES[Math.floor(Math.random() * LINKEDIN_POST_STYLES.length)];
}

/**
 * Rewrite content using Groq AI (free tier)
 */
async function rewriteContent(content, apiKey = null) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
        throw new Error('GROQ_API_KEY is required. Get a free key at https://console.groq.com');
    }

    const groq = new Groq({ apiKey: key });

    // Pick style based on content source
    const style = pickStyle(content.source);
    console.log(`🎨 Post style: ${style}`);

    const prompt = buildPrompt(content, style);

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content:
                    'You are a professional LinkedIn content creator who writes engaging, authentic posts that go viral. Your posts feel personal and genuine, never corporate or robotic.',
            },
            { role: 'user', content: prompt },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.85,
        max_tokens: 500,
        top_p: 0.9,
    });

    const post = chatCompletion.choices[0]?.message?.content?.trim();
    if (!post) throw new Error('AI returned empty response');

    console.log(`✅ Generated post (${post.length} chars)`);
    return {
        text: post,
        style,
        model: 'llama-3.3-70b-versatile',
        sourceTitle: content.title,
        sourceUrl: content.url,
    };
}

// Allow running standalone
if (process.argv[1]?.endsWith('ai-rewriter.js')) {
    const testContent = {
        title: process.argv[2] || 'AI is transforming software development',
        summary:
            'Artificial intelligence tools are changing how developers write code, debug, and deploy applications.',
        topic: 'AI',
        source: 'Dev.to',
        tags: ['ai', 'programming', 'technology'],
    };

    rewriteContent(testContent)
        .then((result) => {
            console.log('\n📝 Generated LinkedIn Post:');
            console.log('---');
            console.log(result.text);
            console.log('---');
        })
        .catch(console.error);
}

module.exports = { rewriteContent };
