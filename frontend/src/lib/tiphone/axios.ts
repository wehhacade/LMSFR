import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { TIPHONE_BASE_URL, REQUEST_TIMEOUT_MS } from "./endpoints";
import { TipStorage, TipTokenService, triggerLogout } from "./storage";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };

let isRefreshing = false;
const failedQueue: QueueEntry[] = [];

function isLoginRequest(config: InternalAxiosRequestConfig): boolean {
  return (config.url ?? "").toLowerCase().includes("/login");
}

function drainQueue(error: unknown, token: string | null) {
  for (const entry of failedQueue) {
    if (error) entry.reject(error);
    else entry.resolve(token!);
  }
  failedQueue.length = 0;
}

async function doTokenRefresh(): Promise<string> {
  const refresh = TipTokenService.getRefreshToken();
  const endpoint = TipTokenService.getRefreshEndpoint() ?? `${TIPHONE_BASE_URL}/login/`;
  if (!refresh) throw new Error("No refresh token available");

  const { data } = await axios.post<{ access: string; refresh?: string }>(
    endpoint,
    { refresh },
    {
      timeout: 10_000,
      headers: { "Content-Type": "application/json", "X-LMSBR-Client": "web" },
    },
  );

  const newAccess = data.access;
  const newRefresh = data.refresh ?? refresh;
  const tokens = {
    access: newAccess,
    refresh: newRefresh,
    refreshEndpoint: endpoint,
  };
  TipTokenService.setTokens(tokens);

  const cached = TipStorage.getCachedAuth();
  if (cached) {
    TipStorage.saveAuth({ ...cached, tokens });
  }

  return newAccess;
}

function attachInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    if (!isLoginRequest(config)) {
      const token = TipTokenService.getAccessToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config as RetryableConfig;

      if (error.response?.status !== 401 || original._retry) {
        return Promise.reject(error);
      }
      if (isLoginRequest(original)) {
        return Promise.reject(error);
      }
      if (!TipTokenService.getRefreshToken()) {
        return Promise.reject(error);
      }
      if (typeof FormData !== "undefined" && original.data instanceof FormData) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return instance(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const newToken = await doTokenRefresh();
        drainQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return instance(original);
      } catch (err) {
        drainQueue(err, null);
        TipStorage.clearAuth();
        triggerLogout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    },
  );
}

export const tiphoneApi = axios.create({
  baseURL: TIPHONE_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-LMSBR-Client": "web",
  },
});

attachInterceptors(tiphoneApi);
