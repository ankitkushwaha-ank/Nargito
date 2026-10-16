import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
// A fixed dummy hash so unknown-account logins cost the same as real ones (anti-enumeration timing).
export const DUMMY_HASH = bcrypt.hashSync("nargito-dummy-password", COST);

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 128) return "Password is too long.";
  if (!/[a-z]/i.test(pw) || !/[0-9]/.test(pw)) return "Include letters and at least one number.";
  return null;
}
