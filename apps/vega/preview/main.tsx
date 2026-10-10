import React from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App";
import { SERVICE_ORIGIN } from "../src/config";

// Transport real requests through the local server, without fabricated responses.
const networkFetch = window.fetch.bind(window);
const paths = new Set(["/api/v1/tv/pair", "/api/v1/tv/feed", "/api/v1/events/search"]);
window.fetch = (input, init) => {
  const url = new URL(String(input), window.location.origin);
  if (url.origin === SERVICE_ORIGIN && paths.has(url.pathname)) {
    return networkFetch(url.pathname + url.search, { ...init, credentials: "omit" });
  }
  return networkFetch(input, init);
};
createRoot(document.getElementById("root")!).render(<App />);
