import { GoogleGenAI, Type } from "@google/genai";
import { findMatchingInventory } from "./lib/shopify";
import { ApiError } from "./lib/apiError";

export interface ProxySwapProductInput {
  base64Image?: string;
  currentProduct?: { name?: string };
}

interface SwapItem {
  id: string;
  shopifyId?: string;
  productUrl?: string;
  name: string;
  description: string;
  price: number;
  colors: string[];
  imageUrl?: string;
  isSynced?: boolean;
}

export interface ProxySwapProductOutput {
  product: SwapItem;
}

export async function handleProxySwapProduct(
  input: ProxySwapProductInput,
): Promise<ProxySwapProductOutput> {
  const { base64Image, currentProduct } = input || {};
  if (!base64Image || !currentProduct?.name) {
    throw new ApiError("invalid-argument", "base64Image and currentProduct.name required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError("internal", "GEMINI_API_KEY not configured.");
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shopifyToken) throw new ApiError("internal", "SHOPIFY_ACCESS_TOKEN not configured.");

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = base64Image.split(",")[1] || base64Image;
  const mimeType =
    base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";")) ||
    "image/jpeg";

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: `Suggest an alternative piece for "${currentProduct.name}". Return name, description, price (USD), colors.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            price: { type: Type.NUMBER },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["name", "price", "colors", "description"],
        },
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_swap_failed", error: (e as Error).message }));
    throw new ApiError("internal", "Swap suggestion failed. Please try again.");
  }

  const item = JSON.parse(response.text || "{}") as {
    name: string;
    description: string;
    price: number;
    colors: string[];
  };

  const match = await findMatchingInventory(item.name, "PRHOMZ", shopifyToken);

  return {
    product: {
      ...item,
      id: `swap-${Date.now()}`,
      shopifyId: match.shopifyId,
      productUrl: match.productUrl,
      imageUrl: match.imageUrl || "",
      name: match.name || item.name,
      price: match.price !== undefined && match.price > 0 ? match.price : item.price,
      isSynced:
        !!match.shopifyId &&
        match.shopifyId !== "external_referral" &&
        !match.shopifyId.startsWith("external_"),
    },
  };
}
