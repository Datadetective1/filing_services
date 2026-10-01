/**
 * Business-registry integrations.
 *
 * Pennsylvania: src/lib/registry/pa-open-data.ts reads the Department of State's monthly
 * open dataset (data.pa.gov). That dataset publishes registrations, not standing or filing
 * history, and can lag the live register. So nothing derived from it may be presented as a
 * status: never "Active", "in good standing", "compliant", "filed", "not filed" or
 * "outstanding". Use neutral wording ("Pennsylvania record found"), keep
 * businesses.standing = 'unknown', and only treat filing history as known when it comes
 * from an authoritative real-time source listed in AUTHORITATIVE_STATUS_SOURCES
 * (src/lib/outreach/segment.ts), of which there are none today.
 */
export {};
