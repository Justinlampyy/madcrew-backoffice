// START region: roles allowlist
// Hier bepaal je wie automatisch admin is bij inloggen met Google.
// Voeg eventueel meer e-mails toe aan de lijst.

const ADMIN_EMAILS = [
  "justinlamberink@gmail.com", // <- jouw e-mailadres
];

/** Check of een e-mailadres in de admin-lijst staat */
export function emailIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
// END region: roles allowlist