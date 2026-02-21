
import { GoogleGenAI } from "@google/genai";
import { FileChange } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateCommitMessage(changes: FileChange[]): Promise<string> {
  const changeSummary = changes
    .map(c => `${c.type}: ${c.path}`)
    .join('\n');

  try {
    // Using ai.models.generateContent directly with model and contents
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, concise, and professional Git commit message (one line) for the following file changes:\n${changeSummary}`,
      config: {
        temperature: 0.7,
        topP: 0.8,
      }
    });

    // Directly access .text property from the response object
    return response.text?.trim() || "chore: update files";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "chore: update project state";
  }
}
