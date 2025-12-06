import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an image based on a text prompt.
 * Uses gemini-2.5-flash-image for standard generation.
 */
export const generateDesignImage = async (
  prompt: string,
  aspectRatio: AspectRatio = "16:9"
): Promise<string> => {
  try {
    // gemini-2.5-flash-image does not support imageSize, only aspectRatio
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    let textResponse = '';

    // Extract image from response
    // The model returns the image in the parts array
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }
    }
    
    // If the model returns text (e.g. refusal or clarification) instead of an image, throw that as the error.
    if (textResponse) {
      throw new Error(textResponse);
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Design generation error:", error);
    throw error;
  }
};

/**
 * Edits an existing image based on instructions.
 * Uses gemini-2.5-flash-image for instruction-based editing.
 */
export const remodelImage = async (
  base64Image: string,
  instruction: string
): Promise<string> => {
  try {
    // Strip prefix if present (e.g. data:image/png;base64,)
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: instruction,
          },
        ],
      },
      // Config isn't strictly needed for default edit behavior, but good to have context
    });

    let textResponse = '';

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }
    }
    
    if (textResponse) {
      throw new Error(textResponse);
    }

    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Remodel error:", error);
    throw error;
  }
};

/**
 * Chat with the AI Architect for advice.
 * Uses gemini-2.5-flash.
 */
export const chatWithArchitect = async (
  history: { role: 'user' | 'model'; text: string }[],
  newMessage: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are PRHOMZ, a world-class interior designer and architect. You provide sophisticated, actionable advice on home design, color theory, and spatial planning. Be concise but helpful.",
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Chat error:", error);
    return "I apologize, but I'm having trouble connecting to my design database right now.";
  }
};