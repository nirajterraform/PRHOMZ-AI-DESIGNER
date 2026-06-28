import { GoogleGenAI, Type } from "@google/genai";
import { findMatchingInventory } from "./lib/shopify";
import { ApiError } from "./lib/apiError";

export interface ProxyShopifySearchInput {
  query?: string;
}

interface ProductItem {
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

export interface ProxyShopifySearchOutput {
  products: ProductItem[];
}

export async function handleProxyShopifySearch(
  input: ProxyShopifySearchInput,
): Promise<ProxyShopifySearchOutput> {
  const { query } = input || {};
  if (!query || !query.trim()) {
    throw new ApiError("invalid-argument", "query required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError("internal", "GEMINI_API_KEY not configured.");

  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Search luxury catalog for items matching: "${query}". Return name, description, price (USD), colors.`,
          },
        ],
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
              colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["name", "price", "colors", "description"],
          },
        },
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_catalog_search_failed", error: (e as Error).message }));
    throw new ApiError("internal", "Catalog search failed. Please try again.");
  }

  const aiItems = JSON.parse(response.text || "[]") as Array<{
    name: string;
    description: string;
    price: number;
    colors: string[];
  }>;

  const results: ProductItem[] = await Promise.all(
    aiItems.map(async (item, index) => {
      const match = findMatchingInventory(item.name, "PRHOMZ");
      return {
        ...item,
        id: `search-${Date.now()}-${index}`,
        shopifyId: match.shopifyId,
        productUrl: match.productUrl,
        imageUrl: match.imageUrl || "",
        name: match.name || item.name,
        price: match.price !== undefined && match.price > 0 ? match.price : item.price,
        isSynced:
          !!match.shopifyId &&
          match.shopifyId !== "external_referral" &&
          !match.shopifyId.startsWith("external_"),
      };
    }),
  );

  return { products: results };
}
