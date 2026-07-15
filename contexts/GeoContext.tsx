import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchShopRegion } from "../services/geoService";

interface GeoState {
  shopEnabled: boolean;
  country: string | null;
  loading: boolean;
}

// Default: shop enabled. The frontend fails OPEN to match the backend — the
// server is the authoritative gate, so a failed/slow /geo call must never leave
// a legitimate US user unable to shop. Non-US users are still blocked server-side.
const GeoContext = createContext<GeoState>({ shopEnabled: true, country: null, loading: true });

export const GeoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GeoState>({ shopEnabled: true, country: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetchShopRegion()
      .then((v) => {
        if (!cancelled) setState({ shopEnabled: v.shopEnabled, country: v.country, loading: false });
      })
      .catch(() => {
        // Fail open on any error (offline, 401 during token refresh, etc.).
        if (!cancelled) setState({ shopEnabled: true, country: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <GeoContext.Provider value={state}>{children}</GeoContext.Provider>;
};

export const useShopRegion = (): GeoState => useContext(GeoContext);
