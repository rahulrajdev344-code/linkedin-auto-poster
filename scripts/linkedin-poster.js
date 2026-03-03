/**
 * LinkedIn Poster — posts content to LinkedIn via REST API
 * Uses LinkedIn's official Share API with OAuth2
 */

/**
 * Post a text update to LinkedIn
 */
async function postToLinkedIn(postText, accessToken = null, personUrn = null) {
    const token = accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
    const urn = personUrn || process.env.LINKEDIN_PERSON_URN;

    if (!token) throw new Error('LINKEDIN_ACCESS_TOKEN is required');
    if (!urn) throw new Error('LINKEDIN_PERSON_URN is required (format: urn:li:person:XXXXX)');

    const payload = {
        author: urn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                    text: postText,
                },
                shareMediaCategory: 'NONE',
            },
        },
        visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LinkedIn API error ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    console.log('✅ Posted to LinkedIn successfully!');
    console.log(`📎 Post ID: ${result.id}`);

    return {
        success: true,
        postId: result.id,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Verify LinkedIn access token is valid
 */
async function verifyToken(accessToken = null) {
    const token = accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
    if (!token) throw new Error('LINKEDIN_ACCESS_TOKEN is required');

    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error(`Token verification failed (${response.status}). Token may be expired.`);
    }

    const profile = await response.json();
    console.log(`✅ Token valid. Logged in as: ${profile.name}`);
    return profile;
}

// Allow running standalone to test token
if (process.argv[1]?.endsWith('linkedin-poster.js')) {
    verifyToken()
        .then((profile) => {
            console.log('\n👤 LinkedIn Profile:');
            console.log(JSON.stringify(profile, null, 2));
        })
        .catch(console.error);
}

module.exports = { postToLinkedIn, verifyToken };
