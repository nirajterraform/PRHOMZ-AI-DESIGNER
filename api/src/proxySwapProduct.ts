import { Type } from "@google/genai";
import { genAiClient } from "./lib/genaiClient";
import { findMatchingInventory, ProductSource } from "./lib/shopify";
import { ApiError } from "./lib/apiError";

export interface ProxySwapProductInput {
  base64Image?: string;
  currentProduct?: { name?: string; price?: number };
  /**
   * The marketplace the user picked in Shop the Look. Must match the source the
   * original list was generated against, or the swapped item gets a "Buy on
   * Amazon" button pointing at a different store. Older clients omit it.
   */
  source?: ProductSource;
}

const VALID_SOURCES: ProductSource[] = ["PRHOMZ", "Amazon", "Wayfair", "IKEA"];

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
  const source: ProductSource = VALID_SOURCES.includes(input?.source as ProductSource)
    ? (input!.source as ProductSource)
    : "PRHOMZ";
  const currentPrice =
    typeof currentProduct.price === "number" &&
    Number.isFinite(currentProduct.price) &&
    currentProduct.price > 0
      ? currentProduct.price
      : undefined;

  const ai = genAiClient();

  const base64Data = base64Image.split(",")[1] || base64Image;
  const mimeType =
    base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";")) ||
    "image/jpeg";

  // Mirrors the wording used by the initial scan so a swapped item stays in the
  // same catalogue the user is shopping from.
  const sourceInstruction =
    source === "PRHOMZ"
      ? " Focus on high-end Atelier pieces and artisan decor."
      : ` The alternative must be an item commonly available on ${source}.com and matching the ${source} inventory catalog. Do not suggest an item that is only sold elsewhere.`;

  // Keep the swap in the same price band as the piece it replaces, otherwise a
  // single swap can push the curation total well past the user's budget or
  // gut it.
  const priceInstruction = currentPrice
    ? ` The piece being replaced costs $${Math.round(currentPrice).toLocaleString("en-US")}; price the alternative within roughly 75%-125% of that so the overall budget holds. Keep the price realistic for the item.`
    : "";

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            {
              text: `Suggest an alternative piece for "${currentProduct.name}" (SOURCE: ${source}).${sourceInstruction}${priceInstruction} Return name, description, price (USD), colors.`,
            },
          ],
        },
      ],
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

  const match = findMatchingInventory(item.name, source);

  // sourceSent distinguishes "the client didn't send a source" (stale bundle)
  // from "the client sent one and we resolved it" — without it a swap that
  // silently falls back to PRHOMZ looks identical to one that was asked for.
  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "product_swap_complete",
      sourceSent: input?.source ?? null,
      sourceUsed: source,
      replacedPrice: currentPrice ?? null,
      newPrice: item.price,
      productUrl: match.productUrl,
    }),
  );

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
