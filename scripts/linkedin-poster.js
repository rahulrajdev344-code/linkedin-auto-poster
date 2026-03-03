/**
 * LinkedIn Poster — posts content to LinkedIn via REST API
 * Supports both text-only and image posts
 * Uses LinkedIn's official UGC/Share API with OAuth2
 */

const fs = require('fs');

/**
 * Register an image upload with LinkedIn and upload the image
 * Returns the image asset URN for use in the post
 */
async function uploadImageToLinkedIn(imagePath, accessToken, personUrn) {
    const token = accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
    const urn = personUrn || process.env.LINKEDIN_PERSON_URN;

    // Step 1: Register the image upload
    console.log('📤 Registering image upload with LinkedIn...');
    const registerPayload = {
        registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: urn,
            serviceRelationships: [
                {
                    relationshipType: 'OWNER',
                    identifier: 'urn:li:userGeneratedContent',
                },
            ],
        },
    };

    const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerPayload),
    });

    if (!registerRes.ok) {
        const err = await registerRes.text();
        throw new Error(`Image register failed (${registerRes.status}): ${err}`);
    }

    const registerData = await registerRes.json();
    const uploadUrl =
        registerData.value.uploadMechanism[
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ].uploadUrl;
    const assetUrn = registerData.value.asset;

    console.log(`📤 Upload URL obtained. Asset: ${assetUrn}`);

    // Step 2: Upload the actual image binary
    console.log('📤 Uploading image binary...');
    const imageBuffer = fs.readFileSync(imagePath);

    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
        },
        body: imageBuffer,
    });

    if (!uploadRes.ok && uploadRes.status !== 201) {
        const err = await uploadRes.text();
        throw new Error(`Image upload failed (${uploadRes.status}): ${err}`);
    }

    console.log(`✅ Image uploaded successfully! Asset: ${assetUrn}`);
    return assetUrn;
}

/**
 * Post to LinkedIn with an optional image
 */
async function postToLinkedIn(postText, imageAssetUrn = null, accessToken = null, personUrn = null) {
    const token = accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
    const urn = personUrn || process.env.LINKEDIN_PERSON_URN;

    if (!token) throw new Error('LINKEDIN_ACCESS_TOKEN is required');
    if (!urn) throw new Error('LINKEDIN_PERSON_URN is required (format: urn:li:person:XXXXX)');

    let shareContent;

    if (imageAssetUrn) {
        // Post WITH image
        shareContent = {
            shareCommentary: {
                text: postText,
            },
            shareMediaCategory: 'IMAGE',
            media: [
                {
                    status: 'READY',
                    media: imageAssetUrn,
                },
            ],
        };
        console.log('📸 Posting with image...');
    } else {
        // Text-only post
        shareContent = {
            shareCommentary: {
                text: postText,
            },
            shareMediaCategory: 'NONE',
        };
        console.log('📝 Posting text-only...');
    }

    const payload = {
        author: urn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': shareContent,
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
        hasImage: !!imageAssetUrn,
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

module.exports = { postToLinkedIn, uploadImageToLinkedIn, verifyToken };
