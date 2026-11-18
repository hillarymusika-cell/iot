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

async function readJsonResponse(response, operation) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    const hint = response.status >= 500
      ? " Check the backend logs and confirm database migrations have been applied."
      : " Verify the configured API URL.";
    throw new Error(
      `${operation} (${response.status}) returned a non-JSON response.${hint}`,
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${operation} returned invalid JSON.`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`${operation} returned an unexpected response.`);
  }
  if (!response.ok) {
    throw new Error(responseError(payload, `${operation} failed (${response.status}).`));
  }
  return payload;
}

async function getCsrfToken() {
  const { auth } = await getApiUrls();
  const response = await fetch(auth.csrf, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  const payload = await readJsonResponse(response, "Could not prepare authentication");
  if (!payload.csrfToken) {
    throw new Error(payload.detail || `Could not prepare authentication (${response.status}).`);
  }
  return payload.csrfToken;
}

async function refreshAccessToken() {
  const csrfToken = await getCsrfToken();
  const { auth } = await getApiUrls();
  const response = await fetch(auth.refresh, {
    method: "POST",
    headers: { Accept: "application/json", "X-CSRFToken": csrfToken },
    credentials: "include",
  });
  if (response.status === 401) return null;
  const payload = await readJsonResponse(response, "Could not restore your session");
  if (!payload.access) {
    throw new Error(payload.detail || `Could not restore your session (${response.status}).`);
  }
  return payload.access;
}

function responseError(payload, fallback) {
  if (typeof payload.detail === "string") return payload.detail;
  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return fallback;
}

function normalizeReadings(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.results;
  if (!Array.isArray(rows)) {
    throw new Error("The readings endpoint returned an unexpected response.");
  }
  return rows
    .map((row) => ({
      value: Number(row.moisturereading ?? row.moisture_reading ?? row.moisture),
      time: row.updatetime ?? row.uploadtime ?? row.timestamp ?? null,
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => {
      if (!a.time || !b.time) return 0;
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    });
}

function formatTime(value, options = {}) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatMetric(value, unit = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
}

function Icon({ name }) {
  const paths = {
    leaf: "M20.8 3.2C11.7 3.3 5.2 6 3.4 11.1c-1.2 3.4 1.2 6.7 4.7 6.4 4.8-.4 9.4-5.3 12.7-14.3ZM4 21c3-6.2 7.3-9.9 13-12",
    refresh: "M20 7v5h-5M4 17v-5h5m-4 0a7 7 0 0 1 12-4l3 4M4 12l3 4a7 7 0 0 0 12-4",
    arrow: "M7 17 17 7M7 7h10v10",
    close: "m6 6 12 12M18 6 6 18",
    copy: "M8 8V4h12v12h-4M4 8h12v12H4z",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    eyeOff: "M3 3l18 18M10.5 10.6A3 3 0 0 0 13.4 13.5M7 7.2C4.4 8.6 2.8 10.7 2 12c0 0 3.5 7 10 7 1.8 0 3.4-.4 4.7-1M14.1 9.1C15.3 9.9 16 11 16 12a4 4 0 0 1-4 4c-.7 0-1.3-.1-1.9-.4M9.9 5.1C10.6 5 11.3 5 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.3 3.1",
  };
  return h(
    "svg",
    {
      "aria-hidden": "true",
      className: "icon",
      fill: "none",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 1.8,
      viewBox: "0 0 24 24",
    },
    h("path", { d: paths[name] }),
  );
}

function AuthDialog({ onClose, onSuccess, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function authenticate(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) throw new Error("Enter your email address.");
      if (!password) throw new Error("Enter your password.");
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
      }

      const csrfToken = await getCsrfToken();
      const { auth } = await getApiUrls();
      const endpoint = mode === "signup" ? auth.signup : auth.login;
      const body =
        mode === "signup"
          ? { email: trimmedEmail, password, confirm_password: confirmPassword }
          : { email: trimmedEmail, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const payload = await readJsonResponse(
        response,
        mode === "signup" ? "Could not create your account" : "Could not sign in",
      );
      if (!payload.access) {
        throw new Error(
          responseError(
            payload,
            `Could not ${mode === "signup" ? "create your account" : "sign in"} (${response.status}).`,
          ),
        );
      }
      onSuccess({ access: payload.access, user: payload.user || null });
    } catch (requestError) {
      setError(requestError.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function passwordField({ id, label, value, onChange, autoComplete, show, onToggle }) {
    return [
      h("label", { className: "field-label", htmlFor: id, key: `${id}-label` }, label),
      h("div", { className: "password-field", key: `${id}-wrap` },
        h("input", {
          autoComplete,
          className: "text-input password-input",
          id,
          onChange: (event) => onChange(event.target.value),
          required: true,
          type: show ? "text" : "password",
          value,
        }),
        h("button", {
          "aria-label": show ? "Hide password" : "Show password",
          className: "password-toggle",
          onClick: (event) => {
            event.preventDefault();
            onToggle(!show);
          },
          type: "button",
        }, h(Icon, { name: show ? "eyeOff" : "eye" })),
      ),
    ];
  }

  return h("div", {
    className: "modal-backdrop",
    onMouseDown: (event) => {
      if (event.target === event.currentTarget) onClose();
    },
  },
    h("section", {
      className: "dialog",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "auth-title",
    },
      h("button", {
        className: "icon-button dialog-close",
        type: "button",
        onClick: onClose,
        "aria-label": "Close",
      }, h(Icon, { name: "close" })),
      h("p", { className: "eyebrow" }, "YOUR FIELDNOTE ACCOUNT"),
      h("h2", { id: "auth-title" }, mode === "signup" ? "Create an account" : "Sign in"),
      h("p", { className: "dialog-copy" }, "Sign in to create and manage sensor devices."),
      h("form", { onSubmit: authenticate },
        h("label", { className: "field-label", htmlFor: "auth-email" }, "Email"),
        h("input", {
          autoComplete: "email",
          autoFocus: true,
          className: "text-input",
          id: "auth-email",
          onChange: (event) => setEmail(event.target.value),
          required: true,
          type: "email",
          value: email,
        }),
        ...passwordField({
          id: "auth-password",
          label: "Password",
          value: password,
          onChange: setPassword,
          autoComplete: mode === "signup" ? "new-password" : "current-password",
          show: showPassword,
          onToggle: setShowPassword,
        }),
        mode === "signup"
          ? passwordField({
              id: "auth-confirm-password",
              label: "Confirm password",
              value: confirmPassword,
              onChange: setConfirmPassword,
              autoComplete: "new-password",
              show: showConfirmPassword,
              onToggle: setShowConfirmPassword,
            })
          : null,
        error && h("p", { className: "form-error", role: "alert" }, error),
        h("button", {
          className: "button button-primary full-button",
          type: "submit",
          disabled: busy,
        }, busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"),
      ),
      h("button", {
        className: "auth-switch",
        type: "button",
        onClick: () => {
          setMode(mode === "signup" ? "login" : "signup");
          setPassword("");
          setConfirmPassword("");
          setShowPassword(false);
          setShowConfirmPassword(false);
          setError("");
        },
      }, mode === "signup" ? "Already have an account? Sign in" : "Do not have account? Create an account"),
    ),
  );
}

function MoistureChart({ readings }) {
  const width = 1000;
  const height = 260;
  const inset = { top: 16, right: 12, bottom: 28, left: 12 };
  const values = readings.map((reading) => reading.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = readings.map((reading, index) => {
    const x = inset.left + (index / Math.max(readings.length - 1, 1)) * (width - inset.left - inset.right);
    const y = height - inset.bottom - ((reading.value - min) / span) * (height - inset.top - inset.bottom);
    return { x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${inset.left},${height - inset.bottom} ${line} ${width - inset.right},${height - inset.bottom}`;
  const latest = points[points.length - 1];
  const first = readings[0];
  const lastReading = readings[readings.length - 1];

  return h("div", { className: "chart-wrap" },
    h("div", { className: "chart-axis-labels", "aria-hidden": "true" },
      h("span", null, `${max.toLocaleString()}%`),
      h("span", null, `${((max + min) / 2).toLocaleString()}%`),
      h("span", null, `${min.toLocaleString()}%`),
    ),
    h("svg", {
      className: "chart",
      role: "img",
      "aria-label": `Moisture readings over time. Latest reading ${lastReading.value}.`,
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "none",
    },
      h("defs", null,
        h("linearGradient", { id: "chart-fill", x1: "0", x2: "0", y1: "0", y2: "1" },
          h("stop", { offset: "0%", stopColor: "#388a5d", stopOpacity: ".23" }),
          h("stop", { offset: "100%", stopColor: "#388a5d", stopOpacity: "0" }),
        ),
      ),
      h("line", { className: "grid-line", x1: "0", x2: width, y1: height / 2, y2: height / 2 }),
      h("polygon", { points: area, fill: "url(#chart-fill)" }),
      h("polyline", { className: "chart-line", points: line }),
      h("circle", { className: "chart-dot", cx: latest.x, cy: latest.y, r: "5" }),
    ),
    h("div", { className: "chart-dates" },
      h("span", null, formatTime(first.time, { month: "short", day: "numeric" })),
      h("span", null, formatTime(lastReading.time, { month: "short", day: "numeric" })),
    ),
  );
}

function App() {
  const [readings, setReadings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showAuth, setShowAuth] = useState(openSignupFromUrl);
  const [authMode, setAuthMode] = useState(initialAuthMode);
  const [auth, setAuth] = useState(null);

  function openAuth(mode) {
    setAuthMode(mode);
    setShowAuth(true);
  }

  useEffect(() => {
    refreshAccessToken()
      .then((access) => { if (access) setAuth({ access, user: null }); })
      .catch(() => setAuth(null));
  }, []);

  const loadReadings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { readings: readingsUrl } = await getApiUrls();
      const response = await fetch(readingsUrl, { headers: { Accept: "application/json" } });
      const payload = await readJsonResponse(response, "Could not load readings");
      setReadings(normalizeReadings(payload));
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err.message || "Could not load readings.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const { analytics: analyticsUrl } = await getApiUrls();
      const response = await fetch(analyticsUrl, { headers: { Accept: "application/json" } });
      const payload = await readJsonResponse(response, "Could not load analytics");
      setAnalytics(payload);
    } catch (err) {
      setAnalyticsError(err.message || "Could not load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReadings();
    loadAnalytics();
    const id = setInterval(() => {
      loadReadings();
      loadAnalytics();
    }, 30000);
    return () => clearInterval(id);
  }, [loadReadings, loadAnalytics]);

  const latest = readings[readings.length - 1];
  const updatedLabel = lastUpdated
    ? formatTime(lastUpdated, { hour: "numeric", minute: "2-digit", second: "2-digit" })
    : "—";

  return h("main", { className: "app" },
    h("header", { className: "topbar" },
      h("div", { className: "brand" },
        h("span", { className: "brand-mark" }, h(Icon, { name: "leaf" })),
        h("strong", null, "apex"),
      ),
      h("div", { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
        h("span", { className: "badge" }, "SENSOR STUDIO"),
        auth
          ? h("button", {
              className: "button button-quiet",
              type: "button",
              onClick: () => setAuth(null),
            }, "Sign out")
          : h("button", {
              className: "button button-primary",
              type: "button",
              onClick: () => openAuth("login"),
            }, "Sign in"),
      ),
    ),
    error && h("p", { className: "form-error", role: "alert" }, error),
    h("section", { className: "hero-metrics" },
      h("div", { className: "metric" },
        h("p", { className: "eyebrow" }, "LATEST MOISTURE"),
        h("p", { className: "metric-value" }, latest ? formatMetric(latest.value, "%") : "—"),
        h("p", { className: "metric-sub" }, latest?.time ? formatTime(latest.time, { dateStyle: "medium", timeStyle: "short" }) : "Waiting for data"),
      ),
      h("div", { className: "metric" },
        h("p", { className: "eyebrow" }, "READINGS"),
        h("p", { className: "metric-value" }, String(readings.length)),
        h("p", { className: "metric-sub" }, "samples in view"),
      ),
      h("div", { className: "metric" },
        h("p", { className: "eyebrow" }, "ANALYTICS"),
        h("p", { className: "metric-value" }, analytics ? formatMetric(Number(analytics.average ?? analytics.avg), "%") : "—"),
        h("p", { className: "metric-sub" }, analyticsError || (analyticsLoading ? "Loading…" : "average")),
      ),
    ),
    h("section", { className: "history-card" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "RECENT ACTIVITY"),
          h("h2", null, "Moisture history"),
        ),
        h("button", { className: "button button-quiet", type: "button", onClick: loadReadings, disabled: loading },
          h(Icon, { name: "refresh" }), loading ? "Refreshing…" : "Refresh",
        ),
      ),
      readings.length > 1
        ? h(MoistureChart, { readings })
        : h("div", { className: "chart-empty" },
            h("strong", null, loading ? "Syncing readings…" : "No readings yet"),
            h("span", null, "Waiting for sensor data from the API"),
          ),
    ),
    h("footer", { className: "footer" },
      h("span", null, "API · https://firmwarebackend.onrender.com"),
      h("span", null, "Last checked ", updatedLabel),
    ),
    showAuth && h(AuthDialog, {
      initialMode: authMode,
      onClose: () => setShowAuth(false),
      onSuccess: (session) => {
        setAuth(session);
        setShowAuth(false);
      },
    }),
  );
}

createRoot(document.getElementById("root")).render(h(App));
