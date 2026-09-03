import { useEffect, type DependencyList } from "react";

/*
 * Reveals every `[data-reveal]` element on the page as it scrolls into view.
 *
 * A sweep rather than an IntersectionObserver, for the same reason the landing
 * page uses one: an observer only reports when the intersection state changes,
 * so a fast scroll or an anchor jump can carry an element in and back out
 * between callbacks and leave it invisible for good. The pending set empties
 * quickly and the listeners detach with it.
 */
export function useReveal(deps: DependencyList = []) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pending = new Set<Element>(document.querySelectorAll("[data-reveal]:not(.is-visible)"));
    if (!pending.size) return;

    let queued = false;

    const sweep = () => {
      queued = false;
      const limit = window.innerHeight * 0.9;

      pending.forEach((target) => {
        if (target.getBoundingClientRect().top > limit) return;
        target.classList.add("is-visible");
        pending.delete(target);
      });

      if (!pending.size) detach();
    };

    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sweep);
    };

    const detach = () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };

    sweep();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);

    return detach;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useReveal;
