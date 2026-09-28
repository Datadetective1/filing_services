/**
 * Public business-registry lookup (future integration point).
 *
 * Today no registry is integrated: customers enter their business details manually
 * and the product says so. When a state's registry can be queried reliably and within
 * its terms of use, implement BusinessRegistryProvider for that state and register it
 * below. Results are stored on businesses.registry_record with
 * standing_source = 'state_registry', and ONLY such results may be shown as coming
 * from the state.
 */

import type { EntityType } from "@/lib/domain/types";

export interface RegistryRecord {
  source: "state_registry";
  stateCode: string;
  legalName: string;
  entityNumber: string;
  entityType: EntityType | null;
  status: string; // as published by the state, e.g. "Active"
  formationDate: string | null;
  registeredOffice: string | null;
  sourceUrl: string; // the official page the record was read from
  retrievedAt: string; // ISO timestamp
}

export interface BusinessRegistryProvider {
  readonly stateCode: string;
  search(query: { legalName?: string; entityNumber?: string }): Promise<RegistryRecord[]>;
}

/** Null adapter: no registry available. Contains no network code by design. */
export class ManualEntryRegistry implements BusinessRegistryProvider {
  constructor(readonly stateCode: string) {}
  async search(): Promise<RegistryRecord[]> {
    return [];
  }
}

const PROVIDERS: Record<string, BusinessRegistryProvider> = {};

export function registryFor(stateCode: string): BusinessRegistryProvider {
  return PROVIDERS[stateCode] ?? new ManualEntryRegistry(stateCode);
}

export function hasRegistryIntegration(stateCode: string): boolean {
  return stateCode in PROVIDERS;
}
