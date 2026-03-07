import { openaiClient } from "../openai.service";

interface GenerateHeadingInput {
  transcription: string;
  title: string;
  headingInstructions?: string;
}

/**
 * Generate a short, viral heading for a video clip using OpenAI.
 * Returns 3–6 words optimized for visual impact on short-form content.
 */
export async function generateViralHeading(input: GenerateHeadingInput): Promise<string> {
  const { transcription, title, headingInstructions } = input;

  const context = [
    title && `Title: ${title}`,
    transcription && `Transcription: ${transcription.slice(0, 800)}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!context) {
    return "Watch This";
  }

  const userDirectionRule = headingInstructions
    ? `\n- IMPORTANT: Follow these specific directions for the heading style/content: ${headingInstructions}`
    : "";

  const response = await openaiClient.responses.create({
    model: "gpt-5-mini",
    instructions:
      "You generate short, catchy, viral headings for short-form video clips (TikTok, Reels, Shorts). " +
      "Rules:\n" +
      "- 3 to 6 words max\n" +
      "- ALL CAPS\n" +
      "- Create curiosity, urgency, or shock value\n" +
      "- Add 1-2 relevant emojis that match the content (e.g. 🔥 💀 😱 🤯 💰 🚀)\n" +
      "- No hashtags, no quotes, no punctuation except !, ?, or emojis\n" +
      "- Return ONLY the heading text, nothing else" +
      userDirectionRule,
    input: `Generate a viral heading for this clip:\n${context}`,
  });

  const heading = response.output_text?.trim();
  if (!heading) {
    return "WATCH THIS";
  }

  return heading;
}
