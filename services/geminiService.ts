
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AspectRatio, ProductItem } from "../types";
import { findMatchingInventory } from "./dataService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDesignImage = async (prompt: string, aspectRatio: AspectRatio = "16:9"): Promise<string> => {
  try {
    const industryConstraint = "PHOTOREALISTIC HIGH-END INTERIOR DESIGN AND HOME FURNISHING VISION: ";
    const styleSuffix = ", architectural photography, detailed textures, interior decor focus, avoid people, focus on furniture and room layout.";
    const finalPrompt = `${industryConstraint} ${prompt} ${styleSuffix}`;
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: finalPrompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio } }
    });
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found");
  } catch (error) { console.error(error); throw error; }
};

export const remodelImage = async (base64Image: string, instruction: string): Promise<string> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';
    const redesignConstraint = "INTERIOR REDESIGN & FURNISHING UPGRADE: Modify this room by ";
    const finalInstruction = `${redesignConstraint} ${instruction}. Maintain consistent architectural perspective.`;
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ inlineData: { data: base64Data, mimeType: mimeType } }, { text: finalInstruction }]
      }
    });
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image returned");
  } catch (error) { console.error(error); throw error; }
};

export const chatWithDesigner = async (history: { role: 'user' | 'model'; text: string }[], newMessage: string): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: { systemInstruction: "You are PRHOMZ AI DESIGNER." },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "No response";
  } catch (error) { console.error(error); return "Connection error"; }
};

/**
 * Analyzes an image, finds objects, and matches them to real inventory.
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
          { text: "Identify distinct furniture items. For each, provide Name, Description, Est. Price, and Colors. Be descriptive for visual matching." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
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
    
    // Match AI items to Real Inventory
    const productsWithMatches = await Promise.all(items.map(async (item: any, index: number) => {
      const inventoryMatch = await findMatchingInventory(item.name);
      
      return {
        ...item,
        id: `prod-${Date.now()}-${index}`,
        shopifyId: inventoryMatch.shopifyId,
        productUrl: inventoryMatch.productUrl,
        stockLevel: inventoryMatch.stockLevel,
        // Prioritize real inventory data including the image URL
        price: inventoryMatch.price || item.price,
        imageUrl: inventoryMatch.imageUrl || `https://loremflickr.com/400/400/furniture,interior,${encodeURIComponent(item.name.replace(/\s+/g, ','))}`
      };
    }));

    return productsWithMatches;
  } catch (error) { console.error(error); return []; }
};

export const searchCatalog = async (query: string): Promise<ProductItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: `Suggest 6 high-end furniture items matching: "${query}".` }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
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
    
    // Also try to match search results to real inventory images
    const searchResultsWithMatches = await Promise.all(items.map(async (item: any, index: number) => {
      const inventoryMatch = await findMatchingInventory(item.name);
      return {
        ...item,
        id: `search-${Date.now()}-${index}`,
        shopifyId: inventoryMatch.shopifyId,
        productUrl: inventoryMatch.productUrl,
        imageUrl: inventoryMatch.imageUrl || `https://loremflickr.com/400/400/furniture,interior,${encodeURIComponent(item.name.replace(/\s+/g, ','))}`
      };
    }));

    return searchResultsWithMatches;
  } catch (error) { console.error(error); return []; }
};

export const swapProduct = async (base64Image: string, currentProduct: ProductItem): Promise<ProductItem> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `Suggest an alternative high-end furniture piece for "${currentProduct.name}" that would look good in this scene.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
    const inventoryMatch = await findMatchingInventory(item.name);

    return { 
      ...item, 
      id: `swap-${Date.now()}`, 
      shopifyId: inventoryMatch.shopifyId,
      productUrl: inventoryMatch.productUrl,
      imageUrl: inventoryMatch.imageUrl || `https://loremflickr.com/400/400/furniture,interior,${encodeURIComponent(item.name.replace(/\s+/g, ','))}` 
    };
  } catch (error) { console.error(error); throw error; }
};
