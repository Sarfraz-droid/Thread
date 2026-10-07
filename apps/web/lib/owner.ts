export function isOwnerAccount(
  user: { email?: string; email_confirmed_at?: string },
  ownerEmail: string | undefined,
) {
  return Boolean(
    ownerEmail?.trim() &&
    user.email_confirmed_at &&
    user.email?.trim().toLowerCase() === ownerEmail.trim().toLowerCase(),
  );
}
