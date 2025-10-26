// Wie mag automatisch admin worden bij eerste login?
const ADMIN_EMAILS = [
  "justinlamberink@gmail.com",
];

export function emailIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
