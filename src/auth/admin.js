export const DEFAULT_ADMIN_EMAIL = 'lucasm.alderete@gmail.com';

export function isAdminEmail(email, adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL) {
  return String(email || '').trim().toLowerCase() === String(adminEmail || '').trim().toLowerCase();
}
