// Security Headers Configuration for Production
// Apply via Vercel/Netlify headers or custom server

// Content Security Policy (CSP) - Strict but allows necessary resources
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://js.stripe.com https://graph.facebook.com https://www.googletagmanager.com https://cdn.sentry.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: https://*.supabase.co https://*.facebook.com https://*.fbcdn.net https://*.supabase.io",
  "connect-src 'self' https://*.supabase.co https://*.supabase.io https://api.razorpay.com https://graph.facebook.com https://graph.instagram.com https://api.stripe.com https://api.sentry.io wss://*.supabase.co",
  "frame-src 'self' https://checkout.razorpay.com https://js.stripe.com https://www.facebook.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
].join('; ');

// Security Headers Object
export const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': CSP,
  'Content-Security-Policy-Report-Only': '', // Enable for testing before enforcing

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // XSS Protection (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',

  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy (Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=(self "https://checkout.razorpay.com")',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),

  // Cross-Origin Embedder Policy
  'Cross-Origin-Embedder-Policy': 'require-corp',

  // Cross-Origin Opener Policy
  'Cross-Origin-Opener-Policy': 'same-origin',

  // Cross-Origin Resource Policy
  'Cross-Origin-Resource-Policy': 'same-origin',

  // HSTS (only in production with valid TLS)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Cache Control for sensitive pages
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',

  // Expect-CT (if using Certificate Transparency)
  'Expect-CT': 'max-age=86400, enforce',

  // Feature Policy (deprecated but still supported)
  'Feature-Policy': [
    'camera none',
    'microphone none',
    'geolocation none',
    'payment self "https://checkout.razorpay.com"',
  ].join('; '),

  // Custom headers for debugging
  'X-DNS-Prefetch-Control': 'on',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

// Vercel Headers Configuration (vercel.json)
export const vercelHeaders = [
  {
    source: '/(.*)',
    headers: Object.entries(securityHeaders).map(([key, value]) => ({
      key,
      value,
    })),
  },
  {
    source: '/assets/(.*)',
    headers: [
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'" },
    ],
  },
  {
    source: '/api/(.*)',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: 'https://app.vitalsync.in' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
    ],
  },
];

// Netlify Headers Configuration (_headers)
export const netlifyHeaders = `
/*
  ${Object.entries(securityHeaders).map(([k, v]) => `${k}: ${v}`).join('\n  ')}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Access-Control-Allow-Origin: https://app.vitalsync.in
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
`;

// Cloudflare Workers Headers (if using Workers)
export function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Express.js Middleware
export function securityHeadersMiddleware(req, res, next) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
}

export default securityHeaders;