"use client";
import { useEffect } from "react";

/* Fade-up on scroll for every [data-reveal] element, staggered 80ms among siblings */
export default function Reveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll("[data-reveal]")];
    if (!("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("reveal-on");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const sibs = [...e.target.parentElement.children].filter((c) => c.hasAttribute("data-reveal"));
          e.target.style.transitionDelay = `${Math.max(0, sibs.indexOf(e.target)) * 80}ms`;
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
