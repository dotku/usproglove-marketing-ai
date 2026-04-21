import type { Vertical } from "@/../content/catalog/products";

export interface DiscoveredCompany {
  externalId: string;
  name: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  countryCode?: string;
  vertical: Vertical;
  subVertical?: string;
  rating?: number;
  reviewCount?: number;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryQuery {
  vertical: Vertical;
  city?: string;
  region?: string;
  radiusMeters?: number;
  latitude?: number;
  longitude?: number;
  limit?: number;
}

export interface DiscoverySource {
  id: string;
  discover(query: DiscoveryQuery): Promise<DiscoveredCompany[]>;
}

export interface EnrichedContact {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  confidence: number;
}

export interface EnrichmentQuery {
  companyName: string;
  domain?: string;
  rolesOfInterest?: string[];
}

export interface EnrichmentProvider {
  id: string;
  find(query: EnrichmentQuery): Promise<EnrichedContact[]>;
  verify(email: string): Promise<{ deliverable: boolean; score: number }>;
}
