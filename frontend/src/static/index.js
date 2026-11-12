import { createElement as h, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

const localHosts = ["localhost", "127.0.0.1"];
const defaultApiBase = localHosts.includes(window.location.hostname)
  ? `http://${window.location.hostname}:8000`
  : window.location.protocol === "file:"
    ? "http://localhost:8000"
    : "";
const API_BASE = (window.IOT_API_BASE || defaultApiBase).replace(/\/$/, "");
const API_ROOT = `${API_BASE}/api/`;
const initialAuthMode = new URLSearchParams(window.location.search).get("auth") === "signup" ? "signup" : "login";
const openSignupFromUrl = initialAuthMode === "signup";
let apiUrlsPromise;

function resolveApiUrl(path) {
  return new URL(path, `${API_BASE || window.location.origin}/`).href;
}

function getApiUrls() {
  if (!apiUrlsPromise) {
    apiUrlsPromise = fetch(API_ROOT, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const urls = await response.json().catch(() => null);
        if (
          !response.ok ||
          !urls?.auth?.csrf ||
          !urls?.auth?.signup ||
          !urls?.auth?.login ||
          !urls?.auth?.refresh ||
          !urls?.auth?.logout ||
          !urls?.devices ||
          !urls?.readings ||
          !urls?.analytics
        ) {
          throw new Error(urls?.detail || `Could not load API endpoints (${response.status}).`);
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

async function getCsrfToken() {
  const { auth } = await getApiUrls();
  const response = await fetch(auth.csrf, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  const payload = await response.json();
  if (!response.ok || !payload.csrfToken) {
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
  const payload = await response.json();
  if (!response.ok || !payload.access) {
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
  const latest = readings[readings.length - 1];
  const first = readings[0];

  return h("div", { className: "chart-wrap" },
    h("div", { className: "chart-axis-labels", "aria-hidden": "true" },
      h("span", null, `${max.toLocaleString()}%`),
      h("span", null, `${((max + min) / 2).toLocaleString()}%`),
      h("span", null, `${min.toLocaleString()}%`),
    ),
    h("svg", {
      className: "chart",
      role: "img",
      "aria-label": `Moisture readings over time. Latest reading ${latest.value}.`,
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "none",
    },
      h("defs", null,
        h("linearGradient", { id: "chart-fill", x1: "0", x2: "0", y1: "0", y2: "1" },
          h("stop", { offset: "0%", stopColor: "#4b8b68", stopOpacity: ".23" }),
          h("stop", { offset: "100%", stopColor: "#4b8b68", stopOpacity: "0" }),
        ),
      ),
      h("line", { className: "grid-line", x1: "0", x2: width, y1: height / 2, y2: height / 2 }),
      h("polygon", { points: area, fill: "url(#chart-fill)" }),
      h("polyline", { className: "chart-line", points: line }),
      h("circle", { className: "chart-dot", cx: latest.x, cy: latest.y, r: "5" }),
    ),
    h("div", { className: "chart-dates" },
      h("span", null, formatTime(first.time, { month: "short", day: "numeric" })),
      h("span", null, formatTime(latest.time, { month: "short", day: "numeric" })),
    ),
  );
}

function AuthDialog({ onClose, onSuccess, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function authenticate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup" && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const csrfToken = await getCsrfToken();
      const { auth } = await getApiUrls();
      const response = await fetch(auth[mode === "signup" ? "signup" : "login"], {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRFToken": csrfToken },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.access) {
        throw new Error(responseError(payload, `Could not ${mode === "signup" ? "create your account" : "sign in"} (${response.status}).`));
      }
      onSuccess({ access: payload.access, user: payload.user || null });
    } catch (requestError) {
      setError(requestError.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return h("div", { className: "modal-backdrop", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onClose();
  } },
    h("section", { className: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "auth-title" },
      h("button", { className: "icon-button dialog-close", type: "button", onClick: onClose, "aria-label": "Close" },
        h(Icon, { name: "close" }),
      ),
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
        h("label", { className: "field-label", htmlFor: "auth-password" }, "Password"),
        h("input", {
          autoComplete: mode === "signup" ? "new-password" : "current-password",
          className: "text-input",
          id: "auth-password",
          onChange: (event) => setPassword(event.target.value),
          required: true,
          type: "password",
          value: password,
        }),
        mode === "signup" && [
          h("label", { className: "field-label", htmlFor: "auth-confirm-password", key: "confirm-label" }, "Confirm password"),
          h("input", {
            autoComplete: "new-password",
            className: "text-input",
            id: "auth-confirm-password",
            key: "confirm-input",
            onChange: (event) => setConfirmPassword(event.target.value),
            required: true,
            type: "password",
            value: confirmPassword,
          }),
        ],
        error && h("p", { className: "form-error", role: "alert" }, error),
        h("button", { className: "button button-primary full-button", type: "submit", disabled: busy },
          busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in",
        ),
      ),
      h("button", {
        className: "auth-switch",
        type: "button",
        onClick: () => {
          setMode(mode === "signup" ? "login" : "signup");
          setPassword("");
          setConfirmPassword("");
          setError("");
        },
      }, mode === "signup" ? "Already have an account? Sign in" : "New to Fieldnote? Create an account"),
    ),
  );
}

function RegistrationDialog({ accessToken, refreshAccess, onClose, onUnauthenticated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState(null);
  const [copied, setCopied] = useState(false);

  async function register(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let token = accessToken;
      const { devices } = await getApiUrls();
      let response = await fetch(devices, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() }),
      });
      if (response.status === 401) {
        token = await refreshAccess();
        if (!token) {
          onUnauthenticated();
          return;
        }
        response = await fetch(devices, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({ name: name.trim() }),
        });
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || `Registration failed (${response.status}).`);
      }
      if (!payload.device_id || !payload.token) {
        throw new Error("The server response did not include device credentials.");
      }
      setDevice(payload);
    } catch (requestError) {
      setError(requestError.message || "Could not register this device.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(`Device ID: ${device.device_id}\nToken: ${device.token}`);
      setCopied(true);
    } catch {
      setError("Clipboard access was unavailable. Copy the credentials manually.");
    }
  }

  return h("div", { className: "modal-backdrop", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onClose();
  } },
    h("section", { className: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dialog-title" },
      h("button", { className: "icon-button dialog-close", type: "button", onClick: onClose, "aria-label": "Close" },
        h(Icon, { name: "close" }),
      ),
      device
        ? h("div", { className: "credentials" },
            h("div", { className: "success-mark" }, "✓"),
            h("p", { className: "eyebrow" }, "Device ready"),
            h("h2", { id: "dialog-title" }, "Save these credentials"),
            h("p", { className: "dialog-copy" }, "The token is shown only once. Add both values to your sensor configuration."),
            h("label", { className: "credential-label" }, "Device ID"),
            h("code", { className: "credential-value" }, device.device_id),
            h("label", { className: "credential-label" }, "Device token"),
            h("code", { className: "credential-value" }, device.token),
            error && h("p", { className: "form-error", role: "alert" }, error),
            h("button", { className: "button button-primary full-button", type: "button", onClick: copyCredentials },
              h(Icon, { name: "copy" }), copied ? "Copied credentials" : "Copy credentials",
            ),
          )
        : h("form", { onSubmit: register },
            h("p", { className: "eyebrow" }, "Device setup"),
            h("h2", { id: "dialog-title" }, "Register a sensor"),
            h("p", { className: "dialog-copy" }, "Create a device identity for a moisture sensor to send readings to this dashboard."),
            h("label", { className: "field-label", htmlFor: "device-name" }, "Device name"),
            h("input", {
              autoFocus: true,
              autoComplete: "off",
              className: "text-input",
              id: "device-name",
              maxLength: 50,
              onChange: (event) => setName(event.target.value),
              placeholder: "e.g. Greenhouse sensor",
              required: true,
              value: name,
            }),
            error && h("p", { className: "form-error", role: "alert" }, error),
            h("button", { className: "button button-primary full-button", type: "submit", disabled: busy },
              busy ? "Registering…" : "Create device",
            ),
          ),
    ),
  );
}

function App() {
  const [readings, setReadings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsEndpoint, setAnalyticsEndpoint] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showAuth, setShowAuth] = useState(openSignupFromUrl);
  const [authMode, setAuthMode] = useState(initialAuthMode);
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    refreshAccessToken()
      .then((access) => { if (access) setAuth({ access, user: null }); })
      .catch(() => setAuth(null))
      .finally(() => setAuthLoading(false));
  }, []);

  async function refreshCurrentAccess() {
    try {
      const access = await refreshAccessToken();
      if (access) setAuth((current) => current ? { ...current, access } : { access, user: null });
      return access;
    } catch {
      setAuth(null);
      return null;
    }
  }

  function openDeviceRegistration() {
    if (auth?.access) setShowRegistration(true);
    else openAuth("login");
  }

  function openAuth(mode) {
    setAuthMode(mode);
    setShowAuth(true);
  }

  async function signOut() {
    try {
      const csrfToken = await getCsrfToken();
      const { auth: authUrls } = await getApiUrls();
      const response = await fetch(authUrls.logout, {
        method: "POST",
        headers: { Accept: "application/json", "X-CSRFToken": csrfToken, Authorization: `Bearer ${auth.access}` },
        credentials: "include",
      });
      if (!response.ok && response.status !== 401) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(responseError(payload, `Could not sign out (${response.status}).`));
      }
    } catch (requestError) {
      setError(requestError.message || "Could not sign out. Please try again.");
      return;
    }
    setAuth(null);
  }

  const loadReadings = useCallback(async () => {
    try {
      const { readings } = await getApiUrls();
      const response = await fetch(readings, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Could not load readings (${response.status}).`);
      const payload = await response.json();
      setReadings(normalizeReadings(payload));
      setError("");
      setLastUpdated(new Date());
    } catch (requestError) {
      setError(requestError.message || "Could not connect to the readings service.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const { analytics: endpoint } = await getApiUrls();
      setAnalyticsEndpoint(new URL(endpoint).pathname);
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Could not load analytics (${response.status}).`);
      const payload = await response.json();
      if (!payload || !Number.isFinite(payload.sample_count) || !payload.moisture) {
        throw new Error("The analytics endpoint returned an unexpected response.");
      }
      setAnalytics(payload);
      setAnalyticsError("");
    } catch (requestError) {
      setAnalyticsError(requestError.message || "Could not connect to the analytics service.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReadings();
    const interval = window.setInterval(loadReadings, 30_000);
    return () => window.clearInterval(interval);
  }, [loadReadings]);

  useEffect(() => {
    loadAnalytics();
    const interval = window.setInterval(loadAnalytics, 30_000);
    return () => window.clearInterval(interval);
  }, [loadAnalytics]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") !== "analytics") return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const latest = readings[readings.length - 1];
  const previous = readings.length > 1 ? readings[readings.length - 2] : null;
  const change = latest && previous ? latest.value - previous.value : null;
  const updatedLabel = useMemo(
    () => lastUpdated ? formatTime(lastUpdated, { hour: "numeric", minute: "2-digit" }) : "Waiting for data",
    [lastUpdated],
  );

  return h("main", { className: "page-shell" },
    h("header", { className: "topbar" },
      h("a", { className: "brand", href: "/", "aria-label": "Apex home" },
        h("span", { className: "brand-mark" }, h(Icon, { name: "leaf" })),
        h("span", null, "apex", h("small", null, "SENSOR STUDIO")),
      ),
      h("nav", { className: "topbar-actions", "aria-label": "Dashboard actions" },
        h("span", { className: "connection-label" },
          h("span", { className: `status-dot${error ? " status-dot-error" : ""}` }),
          error ? "Connection issue" : "Live connection",
        ),
        auth?.access
          ? h("div", { className: "account-actions" },
              h("span", { className: "account-label" }, auth.user?.email || "Signed in"),
              h("button", { className: "button button-outline", type: "button", onClick: openDeviceRegistration }, "＋  Add a device"),
              h("button", { className: "button button-quiet", type: "button", onClick: signOut }, "Sign out"),
            )
          : h("button", {
              className: "button button-outline",
              type: "button",
              onClick: () => openAuth("login"),
              disabled: authLoading,
              "aria-label": "Sign in to add a device",
            },
              authLoading ? "Checking…" : "Sign in",
            ),
      ),
    ),
    h("section", { className: "intro", id: "top" },
      h("div", null,
        h("p", { className: "eyebrow" }, "YOUR GROWING SPACE"),
        h("h1", null, "Moisture, ", h("em", null, "in focus.")),
        h("p", { className: "intro-copy" }, "A clear view of what your soil needs, right when it needs it."),
        h("div", { className: "intro-actions" },
          auth?.access
            ? h("button", { className: "button button-primary", type: "button", onClick: openDeviceRegistration }, "Add a device")
            : h("button", { className: "button button-primary", type: "button", onClick: () => openAuth("signup") }, "Create account"),
          h("a", { className: "button button-outline", href: "#analytics" }, "View analytics"),
        ),
      ),
      h("div", { className: "intro-decoration", "aria-hidden": "true" },
        h("span", { className: "sun-disc" }),
        h("span", { className: "plant-stem" }),
        h("span", { className: "plant-leaf leaf-one" }),
        h("span", { className: "plant-leaf leaf-two" }),
        h("span", { className: "plant-leaf leaf-three" }),
        h("span", { className: "pot" }),
      ),
    ),
    error && h("div", { className: "notice", role: "alert" },
      h("span", null, error),
      h("button", { className: "notice-action", type: "button", onClick: loadReadings }, "Try again"),
    ),
    h("section", { className: "overview-grid", "aria-label": "Sensor overview" },
      h("article", { className: "reading-card" },
        h("div", { className: "card-heading" },
          h("div", null, h("p", { className: "eyebrow" }, "CURRENT MOISTURE"), h("h2", null, "Soil reading")),
          h("span", { className: "reading-icon" }, h(Icon, { name: "leaf" })),
        ),
        loading && readings.length === 0
          ? h("p", { className: "loading-value", "aria-live": "polite" }, "Loading…")
          : latest
            ? h("div", { className: "reading-value" },
                h("strong", null, latest.value.toLocaleString(undefined, { maximumFractionDigits: 1 })),
                h("span", null, "%"),
              )
            : h("div", { className: "empty-reading" }, "No readings yet", h("span", null, "Connect a sensor to see live data.")),
        h("div", { className: "card-footer" },
          h("span", null, latest?.time ? `Recorded ${formatTime(latest.time, { hour: "numeric", minute: "2-digit" })}` : "Updates every 30 seconds"),
          h("span", { className: "live-pill" },
            h("span", { className: `status-dot${error ? " status-dot-error" : ""}` }),
            error ? "PAUSED" : "LIVE",
          ),
        ),
      ),
      h("article", { className: "detail-card" },
        h("p", { className: "eyebrow change-label" }, "LATEST CHANGE"),
        h("div", { className: "detail-value change-value" }, change === null ? "—" : `${change > 0 ? "+" : ""}${change.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
        h("p", { className: "detail-caption change-caption" }, "Compared with the previous reading"),
        h("div", { className: "detail-divider" }),
        h("p", { className: "eyebrow sync-label" }, "LAST SYNC"),
        h("div", { className: "detail-value detail-time sync-value" }, updatedLabel),
        h("p", { className: "detail-caption sync-caption" }, "Automatic refresh every 30 seconds"),
      ),
    ),
    h("section", { className: "analytics-card", id: "analytics", "aria-labelledby": "analytics-title" },
      h("div", { className: "analytics-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "LIVE SUMMARY"),
          h("h2", { id: "analytics-title" }, "Analytics"),
          h("p", { className: "analytics-caption" },
            analytics ? `Last ${analytics.window_hours} hours · ${analytics.sample_count} samples` : "Sensor averages and ranges",
          ),
        ),
        h("div", { className: "endpoint-chip", "aria-label": `Analytics endpoint: ${analyticsEndpoint || "loading"}` },
          h("span", null, "GET"),
          h("code", null, analyticsEndpoint || "Resolving endpoint…"),
        ),
      ),
      analyticsError
        ? h("div", { className: "analytics-error", role: "alert" },
            h("span", null, analyticsError),
            h("button", { className: "notice-action", type: "button", onClick: loadAnalytics }, "Try again"),
          )
        : h("div", { className: "analytics-grid" },
            h("article", { className: "analytics-metric" },
              h("span", null, "Average moisture"),
              h("strong", null, analyticsLoading && !analytics ? "Loading…" : formatMetric(analytics?.moisture?.avg, "%")),
            ),
            h("article", { className: "analytics-metric" },
              h("span", null, "Moisture range"),
              h("strong", null,
                analyticsLoading && !analytics
                  ? "Loading…"
                  : analytics?.moisture?.min == null || analytics?.moisture?.max == null
                    ? "—"
                    : `${formatMetric(analytics.moisture.min)}–${formatMetric(analytics.moisture.max)}%`,
              ),
            ),
            h("article", { className: "analytics-metric" },
              h("span", null, "Average temperature"),
              h("strong", null, analyticsLoading && !analytics ? "Loading…" : formatMetric(analytics?.temperature_avg, "°")),
            ),
            h("article", { className: "analytics-metric" },
              h("span", null, "Average humidity"),
              h("strong", null, analyticsLoading && !analytics ? "Loading…" : formatMetric(analytics?.humidity_avg, "%")),
            ),
          ),
      h("div", { className: "analytics-footer" },
        h("span", null, "Refreshes automatically every 30 seconds"),
        h("button", { className: "button button-quiet", type: "button", onClick: loadAnalytics, disabled: analyticsLoading },
          h(Icon, { name: "refresh" }), analyticsLoading ? "Refreshing…" : "Refresh analytics",
        ),
      ),
    ),
    h("section", { className: "history-card", "aria-labelledby": "history-title" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "RECENT ACTIVITY"),
          h("h2", { id: "history-title" }, "Moisture history"),
        ),
        h("button", { className: "button button-quiet", type: "button", onClick: loadReadings, disabled: loading },
          h(Icon, { name: "refresh" }), loading ? "Refreshing…" : "Refresh",
        ),
      ),
      readings.length > 1
        ? h(MoistureChart, { readings })
        : h("div", { className: "chart-empty" },
            h("div", { className: "chart-empty-mark" }, h(Icon, { name: "leaf" })),
            h("strong", null, loading ? "Gathering your readings" : "Your chart starts here"),
            h("span", null, loading ? "Connecting to your sensor…" : "Once your sensor sends readings, they’ll appear here."),
          ),
      h("div", { className: "history-summary" },
        h("span", null, `${readings.length} ${readings.length === 1 ? "reading" : "readings"} available`),
        h("a", { href: "#devices", onClick: (event) => {
          event.preventDefault();
          openDeviceRegistration();
        } }, "Manage sensors ", h(Icon, { name: "arrow" })),
      ),
    ),
    h("footer", { className: "footer", id: "devices" },
      h("span", null, "FIELDNOTE · SOIL MOISTURE MONITORING"),
      h("span", null, "Last checked ", updatedLabel),
    ),
    showAuth && h(AuthDialog, {
      initialMode: authMode,
      onClose: () => setShowAuth(false),
      onSuccess: (session) => {
        setAuth(session);
        setShowAuth(false);
        setShowRegistration(true);
      },
    }),
    showRegistration && auth?.access && h(RegistrationDialog, {
      accessToken: auth.access,
      refreshAccess: refreshCurrentAccess,
      onClose: () => setShowRegistration(false),
      onUnauthenticated: () => {
        setAuth(null);
        setShowRegistration(false);
        openAuth("login");
      },
    }),
  );
}

createRoot(document.getElementById("root")).render(h(App));
