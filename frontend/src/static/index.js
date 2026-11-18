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
