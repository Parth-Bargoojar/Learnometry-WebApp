import type { MetadataRoute } from "next";

/*
  Served at /manifest.webmanifest — Web App Structure §9.8, decision L1.

  The website's manifest is deliberately `display: "browser"` (it is a marketing site).
  This one is the real app, so it launches standalone straight into the plan.
  A manifest holds a single theme colour, so it carries the light one; the page's
  own <meta name="theme-color"> pair (root layout) switches with the colour scheme.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Learnometry",
    short_name: "Learnometry",
    description: "Your Learnometry diagnostic, study plan and progress.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f1f5f9",
    theme_color: "#f1f5f9",
    lang: "en-IN",
    dir: "ltr",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's plan", short_name: "Plan", url: "/plan", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Practice", short_name: "Practice", url: "/practice", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
