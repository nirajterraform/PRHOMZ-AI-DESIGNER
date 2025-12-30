import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AspectRatio, ProductItem } from "../types";

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

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Design generation error:", error);
    throw error;
  }
};

/**
 * Edits an existing image based on instructions.
 */
export const remodelImage = async (
  base64Image: string,
  instruction: string
): Promise<string> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: instruction },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Remodel error:", error);
    throw error;
  }
};

/**
 * Chat with the AI Architect for advice.
 */
export const chatWithArchitect = async (
  history: { role: 'user' | 'model'; text: string }[],
  newMessage: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are PRHOMZ, a world-class interior designer and architect. Be concise but helpful.",
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
    return "I apologize, but I'm having trouble connecting right now.";
  }
};

/**
 * Analyzes an image to identify products for shopping.
 */
export const generateProductList = async (base64Image: string): Promise<ProductItem[]> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "Identify 3 to 5 distinct furniture or decor items in this image. For each, provide a name, 10-word description, integer price (USD), and 3 color options." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              price: { type: Type.NUMBER },
              colors: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["name", "price", "colors", "description"]
          }
        }
      }
    });

    const items = JSON.parse(response.text || "[]");
    return items.map((item: any, index: number) => ({
      ...item,
      id: item.id || `prod-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Product detection error:", error);
    return [];
  }
};

/**
 * Finds a similar alternative for a product in an image.
 */
export const swapProduct = async (base64Image: string, currentProduct: ProductItem): Promise<ProductItem> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `The user identified a "${currentProduct.name}" (${currentProduct.description}) but wants a similar alternative that fits the same space. Provide ONE new product item with a different design/brand. Output JSON.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            price: { type: Type.NUMBER },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["name", "price", "colors", "description"]
        }
      }
    });

    const item = JSON.parse(response.text || "{}");
    return { ...item, id: `swap-${Date.now()}` };
  } catch (error) {
    console.error("Swap error:", error);
    throw error;
  }
};
