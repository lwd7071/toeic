export function isConfiguredAdmin(identity: { email?: string; email_verified?: boolean; firebase?: { sign_in_provider?: string } }, configuredEmail?: string): boolean {
  return Boolean(configuredEmail?.trim() && identity.email_verified && identity.firebase?.sign_in_provider === "google.com" && identity.email?.toLowerCase() === configuredEmail.trim().toLowerCase());
}
