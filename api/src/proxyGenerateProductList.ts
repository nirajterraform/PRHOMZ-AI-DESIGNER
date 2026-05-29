import { GoogleGenAI, Type } from "@google/genai";
import { findMatchingInventory, ProductSource } from "./lib/shopify";
import { ApiError } from "./lib/apiError";

export interface ProxyGenerateProductListInput {
  base64Image?: string;
  source?: ProductSource;
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

export interface ProxyGenerateProductListOutput {
  products: ProductItem[];
}

export async function handleProxyGenerateProductList(
  input: ProxyGenerateProductListInput,
): Promise<ProxyGenerateProductListOutput> {
  const { base64Image, source = "PRHOMZ" } = input || {};
  if (!base64Image) {
    throw new ApiError("invalid-argument", "base64Image required.");
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

  const sourceInstruction =
    source === "PRHOMZ"
      ? "Focus on high-end Atelier pieces and artisan decor."
      : `Strictly identify items that are commonly available on ${source}.com. Identify items that match the inventory catalog of ${source}.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: `EXHAUSTIVE INTERIOR ARTIFACT SCAN (SOURCE: ${source}): ${sourceInstruction} Identify all pieces of furniture, lighting, and decor. Provide 'name', 'description', and 'price' (USD). Be very specific about brands or styles shown.`,
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
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_product_scan_failed", error: (e as Error).message }));
    throw new ApiError("internal", "Product scan failed. Please try again.");
  }

  const aiItems = JSON.parse(response.text || "[]") as Array<{
    name: string;
    description: string;
    price: number;
    colors: string[];
  }>;

  const productsWithMatches: ProductItem[] = await Promise.all(
    aiItems.map(async (item, index) => {
      const inventoryMatch = await findMatchingInventory(item.name, source, shopifyToken);
      const matchedPrice =
        inventoryMatch.price !== undefined && inventoryMatch.price > 0
          ? inventoryMatch.price
          : item.price;

      return {
        ...item,
        id: `prod-${Date.now()}-${index}`,
        shopifyId: inventoryMatch.shopifyId,
        productUrl: inventoryMatch.productUrl,
        price: matchedPrice,
        imageUrl: inventoryMatch.imageUrl || "",
        name: inventoryMatch.name || item.name,
        isSynced:
          !!inventoryMatch.shopifyId &&
          inventoryMatch.shopifyId !== "external_referral" &&
          !inventoryMatch.shopifyId.startsWith("external_"),
      };
    }),
  );

  return { products: productsWithMatches };
}
