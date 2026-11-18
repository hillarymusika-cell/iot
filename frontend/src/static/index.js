import { createElement as h, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

// Always target the hosted API. Override with window.IOT_API_BASE if needed.
const defaultApiBase = "https://firmwarebackend.onrender.com";
const API_BASE = (window.IOT_API_BASE || defaultApiBase).replace(/\/$/, "");
const API_ROOT = `${API_BASE}/api/`;
const initialAuthMode = new URLSearchParams(window.location.search).get("auth") === "signup" ? "signup" : "login";
const openSignupFromUrl = initialAuthMode === "signup";
let apiUrlsPromise;

function resolveApiUrl(path) {
  const base = (API_BASE || window.location.origin).replace(/\/$/, "");
  const url = path?.startsWith("/") ? path : `/${path ?? ""}`;
  return new URL(url, `${base}/`).href;
}

function getApiUrls() {
  if (!apiUrlsPromise) {
    apiUrlsPromise = fetch(API_ROOT, { headers: { Accept: "application/json" } })
      .then((response) => readJsonResponse(response, "Could not load API endpoints"))
      .then((urls) => {
        if (
          !urls?.auth?.csrf ||
          !urls?.auth?.signup ||
          !urls?.auth?.login ||
          !urls?.auth?.refresh ||
          !urls?.auth?.logout ||
          !urls?.devices ||
          !urls?.readings ||
          !urls?.analytics
        ) {
          throw new Error("The API endpoint index is missing required routes.");
        }
        return {
          auth: Object.fromEntries(
            Object.entries(urls.auth).map(([name, path]) => [name, resolveApiUrl(path)]),
          ),
          devices: resolveApiUrl(urls.devices),
          readings: resolveApiUrl(urls.readings),
          analytics: resolveApiUrl(urls.analytics),
        };
      });
  }
  return apiUrlsPromise;
}
