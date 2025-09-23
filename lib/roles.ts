export function emailIsAdmin(email?: string | null) {
  if (!email) return false
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return env.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}
