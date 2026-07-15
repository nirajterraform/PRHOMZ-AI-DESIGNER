import { apiPost, ApiClientError } from "./apiClient";
import { AspectRatio, ProductItem, ProductSource } from "../types";

// Region gate (Shop the Look is US-only). Callers can catch this to show a
// clear "not available in your region" message instead of an empty result.
export const REGION_NOT_SUPPORTED = "region_not_supported";

interface ProxyImageResult {
  imageId: string;
  url: string;
  storagePath: string;
  watermarked: boolean;
  tier: string;
  monthlyUsed: number;
  monthlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
}

export interface RemodelOptions {
  base64Image: string;
  instruction: string;
  projectName?: string;
}

export interface GenerateOptions {
  prompt: string;
  aspectRatio?: AspectRatio;
  projectName?: string;
}

async function toBase64DataUrl(image: string): Promise<string> {
  if (image.startsWith("data:")) return image;
  const res = await fetch(image);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const remodelImage = async (opts: RemodelOptions): Promise<ProxyImageResult> => {
  const base64Image = await toBase64DataUrl(opts.base64Image);
  return apiPost<RemodelOptions, ProxyImageResult>("/proxyRemodel", { ...opts, base64Image });
};

export const generateDesignImage = (opts: GenerateOptions): Promise<ProxyImageResult> =>
  apiPost<GenerateOptions, ProxyImageResult>("/proxyGenerateImage", opts);

export const chatWithDesigner = async (
  history: { role: "user" | "model"; text: string }[],
  newMessage: string,
): Promise<string> => {
  try {
    const result = await apiPost<
      { history: typeof history; message: string },
      { text: string }
    >("/proxyChat", { history, message: newMessage });
    return result.text;
  } catch (error) {
    console.error(error);
    return "Connection error";
  }
};

export const generateProductList = async (
  image: string,
  source: ProductSource = "PRHOMZ",
): Promise<ProductItem[]> => {
  const base64Image = await toBase64DataUrl(image);
  try {
    const result = await apiPost<
      { base64Image: string; source: ProductSource },
      { products: ProductItem[] }
    >("/proxyGenerateProductList", { base64Image, source });
    return result.products;
  } catch (error) {
    // Let the region block propagate so the UI can message it clearly; all
    // other failures degrade to an empty list as before.
    if (error instanceof ApiClientError && error.code === REGION_NOT_SUPPORTED) throw error;
    console.error(error);
    return [];
  }
};

export const searchCatalog = async (query: string): Promise<ProductItem[]> => {
  try {
    const result = await apiPost<{ query: string }, { products: ProductItem[] }>(
      "/proxyShopifySearch",
      { query },
    );
    return result.products;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const swapProduct = async (
  image: string,
  currentProduct: ProductItem,
): Promise<ProductItem> => {
  const base64Image = await toBase64DataUrl(image);
  const result = await apiPost<
    { base64Image: string; currentProduct: { name: string } },
    { product: ProductItem }
  >("/proxySwapProduct", {
    base64Image,
    currentProduct: { name: currentProduct.name },
  });
  return result.product;
};
