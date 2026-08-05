import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add it to your secrets.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function researchProspect(prospect: { firstName: string; lastName: string; company: string; title: string; linkedinUrl?: string }) {
  try {
    const ai = getAI();
    const prompt = `Research this prospect for a sales outreach campaign. 
    Name: ${prospect.firstName} ${prospect.lastName}
    Company: ${prospect.company}
    Title: ${prospect.title}
    LinkedIn: ${prospect.linkedinUrl || 'Not provided'}

    Provide a summary of their company's recent news, their likely pain points, and a few personalized "hooks" for an email.
    Format the response as Markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI research");
    }

    return response.text;
  } catch (error) {
    console.error("Prospect research failed:", error);
    throw error;
  }
}

export async function generateSequenceTemplate(niche: string, goal: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a 13-step sales outreach sequence for a ${niche} campaign with the goal: ${goal}.
      
      Constraints:
      - Exactly 13 steps.
      - ONLY 'email' and 'call' steps. No LinkedIn.
      - For EVERY 'email' step, provide an A/B variant (variantB and subjectB).
      - Style: Short, punchy "Demand Gen" style messages. No fluff. Direct value proposition.
      - Each email template should be under 150 words.
      - Spread the 13 steps over 30 days.
      
      Return the result as a JSON array of objects with keys: 
      type (email, call), 
      day (number), 
      subject (string, for email), 
      template (string, the main message or call script),
      variantB (string, optional B variant for email),
      subjectB (string, optional B variant subject).`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["email", "call"] },
              day: { type: Type.NUMBER },
              subject: { type: Type.STRING },
              template: { type: Type.STRING },
              variantB: { type: Type.STRING },
              subjectB: { type: Type.STRING }
            },
            required: ["type", "day", "template"]
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    try {
      const steps = JSON.parse(response.text);
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error("Invalid sequence format generated");
      }
      return steps;
    } catch (parseError) {
      console.error("JSON Parse Error. Response text length:", response.text.length);
      console.error("Response text preview:", response.text.substring(0, 500));
      throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    console.error("Sequence generation failed:", error);
    throw error;
  }
}
