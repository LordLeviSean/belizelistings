import { useEffect, useRef } from "react";
import { stableStringifyQuery } from "../utils/queryStringify";

/**
 * @param {object} options
 * @param {"home"|"district"} options.mode
 * @param {import("next/router").NextRouter} options.router
 * @param {string} [options.districtSlug] district dynamic segment (district mode)
 * @param {React.RefObject<HTMLElement | null>} [options.listRef] home listings scroll container
 * @param {number} [options.listDependency] e.g. filtered count — re-bind when list container mounts
 */
export default function useScrollMemory({
  mode,
  router,
  districtSlug = "",
  listRef = null,
  listDependency = 0,
}) {
  const ticking = useRef(false);

  const scrollKey =
    mode === "home"
      ? `homeScroll_${stableStringifyQuery(router.query)}`
      : `districtScroll_${districtSlug}_${stableStringifyQuery(router.query)}`;

  const useElement = mode === "home" && listRef != null;

  /* Restore */
  useEffect(() => {
    if (typeof window === "undefined" || !router.isReady) return;
    if (mode === "district" && !districtSlug) return;

    if (useElement) {
      const el = listRef.current;
      if (!el) return;
      const saved = sessionStorage.getItem(scrollKey);
      if (saved != null) {
        const y = Number(saved);
        if (!Number.isNaN(y)) {
          const t = window.setTimeout(() => {
            el.scrollTop = y;
          }, 50);
          return () => window.clearTimeout(t);
        }
      }
      return;
    }

    const saved = sessionStorage.getItem(scrollKey);
    if (saved != null) {
      const y = Number(saved);
      if (!Number.isNaN(y)) {
        const t = window.setTimeout(() => {
          window.scrollTo(0, y);
        }, 50);
        return () => window.clearTimeout(t);
      }
    }
  }, [scrollKey, router.isReady, mode, districtSlug, useElement, listRef, listDependency]);

  /* Save on scroll */
  useEffect(() => {
    if (typeof window === "undefined" || !router.isReady) return;
    if (mode === "district" && !districtSlug) return;

    if (useElement) {
      const el = listRef.current;
      if (!el) return;

      const onScroll = () => {
        if (ticking.current) return;
        ticking.current = true;
        requestAnimationFrame(() => {
          sessionStorage.setItem(scrollKey, String(el.scrollTop));
          ticking.current = false;
        });
      };

      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey, router.isReady, mode, districtSlug, useElement, listRef, listDependency]);
}
