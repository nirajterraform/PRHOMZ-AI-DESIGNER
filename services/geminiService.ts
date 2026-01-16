
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
      config: { systemInstruction: "You are PRHOMZ AI DESIGNER. You provide elite interior advice and help users curate luxury spaces." },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "No response";
  } catch (error) { console.error(error); return "Connection error"; }
};

/**
 * Performs an exhaustive spatial scan and strictly matches items with Shopify inventory.
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
          { text: "EXHAUSTIVE INTERIOR ARTIFACT SCAN: Identify all pieces of furniture, lighting, and decor. Provide 'name', 'description', and 'price' (USD). Be very specific about brands or styles shown." }
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

    const aiItems = JSON.parse(response.text || "[]");
    
    // STRICT SOURCE SYNC: Overwrite all AI data with actual catalog matches
    const productsWithMatches = await Promise.all(aiItems.map(async (item: any, index: number) => {
      const inventoryMatch = await findMatchingInventory(item.name);
      
      const matchedPrice = (inventoryMatch.price !== undefined && inventoryMatch.price > 0) 
        ? inventoryMatch.price 
        : item.price;

      return {
        ...item,
        id: `prod-${Date.now()}-${index}`,
        shopifyId: inventoryMatch.shopifyId,
        productUrl: inventoryMatch.productUrl,
        stockLevel: inventoryMatch.stockLevel,
        price: matchedPrice,
        imageUrl: inventoryMatch.imageUrl || "",
        name: inventoryMatch.name || item.name,
        isSynced: !!inventoryMatch.shopifyId && inventoryMatch.shopifyId !== 'external_referral'
      } as ProductItem;
    }));

    return productsWithMatches;
  } catch (error) { console.error(error); return []; }
};

export const searchCatalog = async (query: string): Promise<ProductItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: `Search luxury catalog for items matching: "${query}". Return name, description, price, colors.` }] },
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
    
    const searchResultsWithMatches = await Promise.all(items.map(async (item: any, index: number) => {
      const inventoryMatch = await findMatchingInventory(item.name);
      return {
        ...item,
        id: `search-${Date.now()}-${index}`,
        shopifyId: inventoryMatch.shopifyId,
        productUrl: inventoryMatch.productUrl,
        imageUrl: inventoryMatch.imageUrl || "",
        price: inventoryMatch.price || item.price
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
          { text: `Suggest an alternative piece for "${currentProduct.name}". Return name, description, price, colors.` }
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
      imageUrl: inventoryMatch.imageUrl || "",
      price: inventoryMatch.price || item.price
    };
  } catch (error) { console.error(error); throw error; }
};
