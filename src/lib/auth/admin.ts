import { auth0 } from "@/lib/auth0";

const DEFAULT_ADMIN_EMAILS = ["jytech202307@gmail.com"];

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return DEFAULT_ADMIN_EMAILS;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export type AdminCheck =
  | { ok: true; email: string; name: string | null }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

export async function checkAdmin(): Promise<AdminCheck> {
  const session = await auth0.getSession();
  const email = session?.user?.email as string | undefined;
  if (!session || !email) return { ok: false, reason: "unauthenticated" };
  if (!isAdminEmail(email)) return { ok: false, reason: "forbidden" };
  return { ok: true, email, name: (session.user.name as string) || null };
}
