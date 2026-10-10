/**
 * Verifies the shared bearer secret used only by database-triggered push jobs.
 * Supabase JWT verification is disabled for these endpoints because the database
 * trigger uses this separate secret; handlers must still fail closed.
 */
export function hasValidInternalBearer(
  request: Request,
  expectedSecret: string | null | undefined,
): boolean {
  if (!expectedSecret) return false;

  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return false;

  const supplied = authorization.slice(prefix.length);
  if (supplied.length !== expectedSecret.length) return false;

  // Compare the fixed-length secret without early-exit character comparisons.
  let difference = 0;
  for (let index = 0; index < expectedSecret.length; index++) {
    difference |= supplied.charCodeAt(index) ^ expectedSecret.charCodeAt(index);
  }
  return difference === 0;
}
