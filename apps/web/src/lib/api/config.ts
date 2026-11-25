// Base URL of the Yegna API. Defaults to a same-origin path (proxied by Vite in development).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export const REQUEST_TIMEOUT_MS = 20_000;
