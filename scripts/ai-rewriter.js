/**
 * AI Rewriter — rewrites scraped content into LinkedIn-style posts
 * Uses Groq API (free tier, Llama 3.3 70B)
 */

const Groq = require('groq-sdk');

const LINKEDIN_POST_STYLES = [
    'thought-leadership',
    'storytelling',
    'tips-and-advice',
    'hot-take',
    'motivational',
];

/**
 * Build a prompt for the AI to rewrite content into a LinkedIn post
 */
function buildPrompt(content, style) {
    const basePrompt = `You are a LinkedIn content creator. Rewrite the following content into an engaging LinkedIn post.

RULES:
- Write in first person, as if sharing your own thoughts/discovery
- Keep it under 1200 characters
- Use short paragraphs (1-2 sentences each)
- Start with a compelling hook (first line is crucial)
- Add line breaks between paragraphs for readability
- Include 3-5 relevant hashtags at the end
- Do NOT use markdown formatting (no **, ##, etc.)
- Do NOT include any URLs or links
- Sound authentic and personal, not robotic
- Add a call-to-action or question at the end to drive engagement`;

    const styleInstructions = {
        'thought-leadership': 'Write as an industry expert sharing a unique insight or perspective.',
        'storytelling': 'Frame this as a personal story or experience. Use "I" statements.',
        'tips-and-advice': 'Present this as practical tips or actionable advice. Use numbered points if appropriate.',
        'hot-take': 'Share a bold, slightly controversial opinion about this topic. Be provocative but professional.',
        'motivational': 'Make this inspiring and uplifting. Connect it to personal growth or career development.',
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
 * Rewrite content using Groq AI (free tier)
 */
async function rewriteContent(content, apiKey = null) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
        throw new Error('GROQ_API_KEY is required. Get a free key at https://console.groq.com');
    }

    const groq = new Groq({ apiKey: key });

    // Pick a random style
    const style = LINKEDIN_POST_STYLES[Math.floor(Math.random() * LINKEDIN_POST_STYLES.length)];
    console.log(`🎨 Post style: ${style}`);

    const prompt = buildPrompt(content, style);

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content: 'You are a professional LinkedIn content creator who writes engaging, authentic posts.',
            },
            { role: 'user', content: prompt },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8,
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
        summary: 'Artificial intelligence tools are changing how developers write code, debug, and deploy applications.',
        topic: 'AI',
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
