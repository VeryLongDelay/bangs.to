const BASE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// SW runtime avoids eval; keep CSP strict.
export const SW_CSP =
  "default-src 'self'; script-src 'self'; connect-src 'self'";

export const SW_HEADERS: Record<string, string> = {
  "Content-Security-Policy": SW_CSP,
  ...BASE_HEADERS,
};

export function pageHeaders(scriptSrc: string): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' https://tally.so ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://tally.so https://*.tally.so",
      "img-src 'self' data: https://tally.so https://*.tally.so",
      "font-src 'self'",
      "frame-src 'self' https://tally.so",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    ...BASE_HEADERS,
  };
}
