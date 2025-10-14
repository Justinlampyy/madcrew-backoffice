// /lib/roles.ts
export function emailIsAdmin(email?: string | null): boolean {
  if (!email) return false
  // Lees uit public env, maar crasht nooit als die ontbreekt
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  // Komma/; / spaties toegestaan, case-insensitive
  const allow = raw
    .split(/[,\n; ]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return allow.includes(email.toLowerCase())
}
