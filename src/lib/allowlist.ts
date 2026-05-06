// Single-tenant allowlist. Only this Google account may use the app.
// Enforced client-side; combine with backend RLS for real security.
export const ALLOWED_EMAILS = ["drfrafiq@gmail.com"] as const;

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase() as (typeof ALLOWED_EMAILS)[number]);
}
