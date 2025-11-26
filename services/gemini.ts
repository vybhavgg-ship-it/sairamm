import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ChatPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// 1. General Chat Logic (Text + Image Context)
export const generateChatResponse = async (
  history: { role: string; parts: ChatPart[] }[],
  systemInstruction: string = "You are a helpful and casual friend on a chat app."
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history.map(h => ({
        role: h.role,
        parts: h.parts
      })),
      config: {
        systemInstruction,
      }
    });
    return response.text || "Read 10:00 PM"; 
  } catch (error) {
    console.error("Chat Error:", error);
    return "Sorry, I couldn't reply right now.";
  }
};

// 2. Image Analysis (Gemini 3 Pro Preview)
export const analyzeImage = async (base64Image: string, prompt: string = "Describe this image"): Promise<string> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
    });
    return response.text || "I couldn't see anything in that image.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "Failed to analyze image. Please try again.";
  }
};

// 3. Image Editing (Gemini 2.5 Flash Image - Nano Banana)
export const editImage = async (base64Image: string, prompt: string): Promise<{ text?: string, image?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
    });

    let resultText = "";
    let resultImage = "";

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          resultImage = part.inlineData.data;
        } else if (part.text) {
          resultText += part.text;
        }
      }
    }

    return { text: resultText, image: resultImage };
  } catch (error) {
    console.error("Edit Error:", error);
    return { text: "I encountered an error while trying to edit your photo." };
  }
};