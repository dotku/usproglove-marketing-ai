import type { EnrichedContact, EnrichmentProvider, EnrichmentQuery } from "../types";

const SNOV_BASE = "https://api.snov.io/v1";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SNOV_CLIENT_ID / SNOV_CLIENT_SECRET not set");

  const res = await fetch(`${SNOV_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export const snovProvider: EnrichmentProvider = {
  id: "s2",
  async find(query: EnrichmentQuery): Promise<EnrichedContact[]> {
    if (!query.domain) return [];
    const token = await getAccessToken();
    const res = await fetch(`${SNOV_BASE}/get-domain-emails-with-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain: query.domain, type: "all", limit: 10 }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      emails?: Array<{ email: string; firstName?: string; lastName?: string; position?: string }>;
    };
    return (data.emails ?? []).map((e) => ({
      email: e.email,
      firstName: e.firstName,
      lastName: e.lastName,
      role: e.position,
      confidence: 50,
    }));
  },

  async verify(email: string) {
    const token = await getAccessToken();
    const res = await fetch(`${SNOV_BASE}/get-emails-verification-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emails: [email] }),
    });
    if (!res.ok) return { deliverable: false, score: 0 };
    const data = (await res.json()) as { data?: Array<{ result?: string }> };
    const result = data.data?.[0]?.result;
    return { deliverable: result === "deliverable", score: result === "deliverable" ? 90 : 0 };
  },
};
