
import { GoogleGenAI, Type } from "@google/genai";
import { FileChange } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateCommitMessage(changes: FileChange[]): Promise<string> {
  const changeSummary = changes
    .map(c => `${c.type}: ${c.path}`)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, concise, and professional Git commit message (one line) for the following file changes:\n${changeSummary}`,
      config: {
        temperature: 0.7,
        topP: 0.8,
      }
    });

    return response.text?.trim() || "chore: update files";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "chore: update project state";
  }
}

export async function parseProjectInput(input: string): Promise<{ name: string; path: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Parse the following user request to add a project. Extract the project name and the file path. 
      If no name is explicitly provided, infer a short, slug-style name from the path.
      Return ONLY valid JSON.
      
      User request: "${input}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Short descriptive name of the project" },
            path: { type: Type.STRING, description: "Full filesystem path" }
          },
          required: ["name", "path"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    if (result.name && result.path) return result;
    return null;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return null;
  }
}
