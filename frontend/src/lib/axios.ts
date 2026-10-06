import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, redirectToLogin } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v3";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "X-LMSBR-Client": "web",
  },
});

/** Login/register 401s must surface to the form — not trigger refresh/redirect. */
function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return /\/auth\/(login|register|forgot-password|reset-password|verify-otp)\/?(\?.*)?$/.test(url);
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Let the browser set multipart boundaries; a bare multipart/form-data header drops fields.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

let isRefreshing = false;
let queue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const flushQueue = (err: unknown, token: string | null = null) => {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token!)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      original._retry ||
      isPublicAuthRequest(original.url)
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => queue.push({ resolve, reject }))
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
    }

    original._retry = true;
    isRefreshing = true;

    const refresh = getRefreshToken();
    if (!refresh) {
      redirectToLogin("auth_failed");
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh }, {
        headers: { "Content-Type": "application/json", "X-LMSBR-Client": "web" },
      });
      setTokens(data);
      flushQueue(null, data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (err) {
      flushQueue(err);
      redirectToLogin("session_expired");
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
