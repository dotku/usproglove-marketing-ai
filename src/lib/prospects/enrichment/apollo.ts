import type { EnrichedContact, EnrichmentProvider, EnrichmentQuery } from "../types";

const APOLLO_BASE = "https://api.apollo.io/v1";

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: "verified" | "unverified" | "likely to engage" | "unavailable" | string;
  organization?: { primary_domain?: string; website_url?: string };
}

function confidenceFor(status?: string): number {
  if (status === "verified") return 90;
  if (status === "likely to engage") return 70;
  if (status === "unverified") return 40;
  return 20;
}

function isUsableEmail(email: string | undefined): email is string {
  if (!email) return false;
  if (email.includes("email_not_unlocked")) return false;
  if (email.includes("domain.com") && email.startsWith("email_not_unlocked")) return false;
  return email.includes("@");
}

export const apolloProvider: EnrichmentProvider = {
  id: "a3",

  async find(query: EnrichmentQuery): Promise<EnrichedContact[]> {
    const key = process.env.APOLLO_API_KEY;
    if (!key) return [];
    if (!query.domain) return [];

    const body: Record<string, unknown> = {
      q_organization_domains_list: [query.domain],
      page: 1,
      per_page: 10,
    };
    if (query.rolesOfInterest?.length) body.person_titles = query.rolesOfInterest;

    const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": key,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
    const rows = [...(data.people ?? []), ...(data.contacts ?? [])];

    return rows
      .filter((p) => isUsableEmail(p.email))
      .map((p) => ({
        email: p.email!.toLowerCase(),
        firstName: p.first_name,
        lastName: p.last_name,
        role: p.title,
        confidence: confidenceFor(p.email_status),
      }));
  },

  async verify(email: string) {
    const key = process.env.APOLLO_API_KEY;
    if (!key) return { deliverable: false, score: 0 };

    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": key,
      },
      body: JSON.stringify({ email, reveal_personal_emails: false }),
    });
    if (!res.ok) return { deliverable: false, score: 0 };

    const data = (await res.json()) as { person?: ApolloPerson };
    const status = data.person?.email_status;
    return {
      deliverable: status === "verified",
      score: confidenceFor(status),
    };
  },
};
