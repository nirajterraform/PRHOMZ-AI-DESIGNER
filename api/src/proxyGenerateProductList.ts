import { Type } from "@google/genai";
import { genAiClient } from "./lib/genaiClient";
import { findMatchingInventory, ProductSource } from "./lib/shopify";
import { ApiError } from "./lib/apiError";

export interface ProxyGenerateProductListInput {
  base64Image?: string;
  source?: ProductSource;
  /**
   * The user's total furnishing budget in USD, from the Remodeler slider.
   * Optional: older clients omit it, in which case the scan behaves as before
   * (generic price estimates with no budget target).
   */
  budget?: number;
}

// The Remodeler slider spans $500–$50,000. Accept a little beyond that so the
// range can widen without a backend change, but reject anything that isn't a
// sane positive amount before it reaches the prompt.
const MIN_BUDGET = 100;
const MAX_BUDGET = 1_000_000;

function normaliseBudget(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  if (raw < MIN_BUDGET || raw > MAX_BUDGET) return undefined;
  return Math.round(raw);
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
  const budget = normaliseBudget(input?.budget);

  const ai = genAiClient();

  const base64Data = base64Image.split(",")[1] || base64Image;
  const mimeType =
    base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";")) ||
    "image/jpeg";

  const sourceInstruction =
    source === "PRHOMZ"
      ? "Focus on high-end Atelier pieces and artisan decor."
      : `Strictly identify items that are commonly available on ${source}.com. Identify items that match the inventory catalog of ${source}.`;

  // Without this the model prices every room the same way (~$2-3k of generic
  // mid-range goods) regardless of what the user picked on the slider, so the
  // budget appeared to do nothing. Give it the target explicitly and ask it to
  // pick pieces at the matching quality level — never to inflate prices, which
  // would make the estimates useless against the real storefront.
  const budgetInstruction = budget
    ? ` BUDGET TARGET: the user has allocated $${budget.toLocaleString("en-US")} USD in total for furnishing this room. Select the specific pieces and quality tier so the sum of all item prices lands between 85% and 100% of that budget ($${Math.round(
        budget * 0.85,
      ).toLocaleString("en-US")}–$${budget.toLocaleString("en-US")}). For a larger budget choose genuinely higher-end designer or premium pieces and price them at their real retail value; for a smaller budget choose value alternatives. Do NOT inflate the price of a cheap item to fill the budget, and do NOT pad the list with filler decor — change which pieces you recommend instead. Prices must remain realistic for what that item actually sells for.`
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
              text: `EXHAUSTIVE INTERIOR ARTIFACT SCAN (SOURCE: ${source}): ${sourceInstruction} Identify all pieces of furniture, lighting, and decor. Provide 'name', 'description', and 'price' (USD). Be very specific about brands or styles shown.${budgetInstruction}`,
            },
          ],
        },
      ],
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
      const inventoryMatch = findMatchingInventory(item.name, source);
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

  // Observability for the budget fix: lets us confirm from Cloud Logging that
  // the slider value reached the model and how close the returned list landed.
  const scanTotal = productsWithMatches.reduce((sum, p) => sum + (p.price || 0), 0);
  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "product_scan_complete",
      source,
      budget: budget ?? null,
      items: productsWithMatches.length,
      scanTotal,
      budgetUsedPct: budget ? Math.round((scanTotal / budget) * 100) : null,
    }),
  );

  return { products: productsWithMatches };
}
