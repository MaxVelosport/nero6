import { useEffect, useRef } from "react";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

async function callRefresh(): Promise<boolean> {
  const token = localStorage.getItem("authToken");
  if (!token) return false;

  try {
    const resp = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.ok) {
      localStorage.setItem("authTokenIssuedAt", Date.now().toString());
      return true;
    }

    if (resp.status === 401 && localStorage.getItem("authToken")) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return false;
  } catch {
    return false;
  }
}

function shouldRefresh(): boolean {
  const token = localStorage.getItem("authToken");
  if (!token) return false;

  const issuedAt = parseInt(localStorage.getItem("authTokenIssuedAt") || "0");
  if (!issuedAt) {
    localStorage.setItem("authTokenIssuedAt", Date.now().toString());
    return false;
  }

  return Date.now() - issuedAt > REFRESH_AFTER_MS;
}

export function useTokenRefresh() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (shouldRefresh()) {
      callRefresh();
    }

    intervalRef.current = setInterval(() => {
      if (shouldRefresh()) {
        callRefresh();
      }
    }, REFRESH_INTERVAL_MS);

    const onFocus = () => {
      if (shouldRefresh()) {
        callRefresh();
      }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
