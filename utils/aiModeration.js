const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Basic fallback keyword filter
function basicFilter(text) {
  const bannedTopics = [
    "pizza", "burger", "dating", "party", "football",
    "music", "movies", "politics", "gaming", "club",
    "concert", "festival"
  ];
  return !bannedTopics.some(word => text.toLowerCase().includes(word));
}

async function checkDiscussionContent(content) {
  try {
    //   Basic keyword filter
    if (!basicFilter(content)) {
      return {
        allowed: false,
        reason: "Off-topic keyword detected (not school related)"
      };
    }

    //   AI moderation
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a strict moderation system. Only allow posts related to academics, study, exams, notes, assignments, classes, or university topics. Reject anything unrelated like food, dating, sports, politics, or entertainment. Respond with either 'ALLOW' or 'REJECT'.",
        },
        { role: "user", content },
      ],
      max_tokens: 20,
    });

    const aiDecision = response.choices[0].message.content.trim().toLowerCase();

    let allowed = false;
    if (aiDecision.includes("allow")) allowed = true;
    if (aiDecision.includes("reject")) allowed = false;

    return {
      allowed,
      reason: allowed ? "Allowed by AI moderation" : "Rejected by AI moderation",
    };
  } catch (err) {
    console.error("AI moderation error:", err);

    //  Fallback to keyword filter only
    return {
      allowed: basicFilter(content),
      reason: "AI unavailable, used fallback filter",
    };
  }
}

module.exports = { checkDiscussionContent };




