import { apiGet } from "./apiClient";

export interface ShopRegionVerdict {
  country: string | null;
  shopEnabled: boolean;
}

/**
 * Ask the backend whether Shop the Look is available for this client's region.
 * The server enforces the same verdict on the actual endpoints — this just lets
 * the UI hide/disable the button ahead of a click.
 */
export async function fetchShopRegion(): Promise<ShopRegionVerdict> {
  return apiGet<ShopRegionVerdict>("/geo");
}
