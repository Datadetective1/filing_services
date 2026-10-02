/** Shapes shared by funnel server actions and their client forms. Plain types only. */

export interface LookupValues {
  legalName: string;
  stateCode: string;
  entityType: string;
  formationDate: string;
  entityNumber: string;
  isForeign: boolean;
  homeJurisdiction: string;
  isNonprofit: boolean;
  alreadyFiledThisYear: boolean;
}

export interface LookupFormState {
  errors: Record<string, string>;
  formError?: string;
  values?: LookupValues;
  nonce: number;
}

export interface LookupJurisdictionOption {
  code: string;
  name: string;
  /** Official business search (or agency site when no search page is listed). */
  searchUrl: string;
  /** True when searchUrl is a business search page rather than the agency home page. */
  isBusinessSearch: boolean;
  /** The state's due date is set from the formation/registration month, so it's required. */
  formationRequired?: boolean;
}

export interface ActionMessageState {
  error?: string;
  /** Optional follow-up link shown with the error. */
  href?: string;
  hrefLabel?: string;
}
