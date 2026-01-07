
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AspectRatio, ProductItem } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an image based on a text prompt.
 * Strictly anchored to Interior Design and Home Furnishing.
 */
export const generateDesignImage = async (
  prompt: string,
  aspectRatio: AspectRatio = "16:9"
): Promise<string> => {
  try {
    // ENFORCEMENT: Prepend strict domain constraints to the prompt
    const industryConstraint = "PHOTOREALISTIC HIGH-END INTERIOR DESIGN AND HOME FURNISHING VISION: ";
    const styleSuffix = ", architectural photography, detailed textures, interior decor focus, avoid people, focus on furniture and room layout.";
    const finalPrompt = `${industryConstraint} ${prompt} ${styleSuffix}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: finalPrompt }],
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
 * Strictly anchored to Interior Remodeling and Decor Upgrades.
 */
export const remodelImage = async (
  base64Image: string,
  instruction: string
): Promise<string> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';

    // ENFORCEMENT: Force the instruction to be interpreted as an interior redesign
    const redesignConstraint = "INTERIOR REDESIGN & FURNISHING UPGRADE: Modify this room by ";
    const finalInstruction = `${redesignConstraint} ${instruction}. Maintain consistent architectural perspective, focus on decor changes, furniture swapping, and aesthetic refinement.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: finalInstruction },
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
 * Chat with the PRHOMZ AI DESIGNER for advice.
 * Strictly limited to Home Decor, Furnishing, and Design.
 */
export const chatWithDesigner = async (
  history: { role: 'user' | 'model'; text: string }[],
  newMessage: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: `You are PRHOMZ AI DESIGNER, a specialized professional interior designer.
        
        STRICT DOMAIN LIMITATION:
        1. You ONLY answer questions about interior design, home decor, furniture, architecture, and spatial upgrades.
        2. If a user asks about anything else (e.g., coding, general news, random facts, or non-home related images), you must politely refuse: "As a specialized PRHOMZ Designer, I only provide expertise on home decor and interior transformations. Let's focus on your space."
        3. Never generate non-home-related prompts.
        
        FORMATTING RULES:
        1. Never write long paragraphs. 
        2. Use multiple line breaks (\n\n) for clarity.
        3. Use bullet points for curated lists.
        4. Use **bold text** for design terminology.
        
        Be an expert concierge for the home furnishing industry.`,
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
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "Identify EVERY distinct furniture and decor item in this image (up to 10 items). For each item found, provide a name, 15-word description, integer price (USD) based on premium retail values, and 3-5 color options. Include a search query string for the item's visual appearance." }
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
              colors: { type: Type.ARRAY, items: { type: Type.STRING } },
              searchQuery: { type: Type.STRING, description: "Keywords for visual search" }
            },
            required: ["name", "price", "colors", "description", "searchQuery"]
          }
        }
      }
    });

    const items = JSON.parse(response.text || "[]");
    return items.map((item: any, index: number) => {
      const searchKeywords = (item.searchQuery || item.name).replace(/\s+/g, ',');
      return {
        ...item,
        id: item.id || `prod-${Date.now()}-${index}`,
        imageUrl: `https://loremflickr.com/300/300/furniture,interior,${encodeURIComponent(searchKeywords)}`
      };
    });
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
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `The user identified a "${currentProduct.name}" but wants an alternative. Provide ONE new product item with a different design. Output JSON.` }
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
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            searchQuery: { type: Type.STRING }
          },
          required: ["name", "price", "colors", "description", "searchQuery"]
        }
      }
    });

    const item = JSON.parse(response.text || "{}");
    const searchKeywords = (item.searchQuery || item.name).replace(/\s+/g, ',');
    return { 
      ...item, 
      id: `swap-${Date.now()}`,
      imageUrl: `https://loremflickr.com/300/300/furniture,interior,${encodeURIComponent(searchKeywords)}`
    };
  } catch (error) {
    console.error("Swap error:", error);
    throw error;
  }
};
