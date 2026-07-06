import { createContext, useContext, useEffect, useMemo, useState } from "react";
import PageHead from "@/components/PageHead";

const PageTitleContext = createContext(null);

export function PageTitleProvider({ routeTitle, children }) {
  const [overrideTitle, setOverrideTitle] = useState(null);
  const value = useMemo(() => ({ setOverrideTitle }), []);
  const title = overrideTitle || routeTitle;

  return (
    <PageTitleContext.Provider value={value}>
      {title ? <PageHead title={title} /> : null}
      {children}
    </PageTitleContext.Provider>
  );
}

/**
 * Override the route-derived document title (e.g. listing detail after client fetch).
 * @param {string|null|undefined} title
 */
export function usePageTitle(title) {
  const ctx = useContext(PageTitleContext);

  useEffect(() => {
    if (!ctx) return undefined;
    const next = String(title || "").trim() || null;
    ctx.setOverrideTitle(next);
    return () => ctx.setOverrideTitle(null);
  }, [title, ctx]);
}
