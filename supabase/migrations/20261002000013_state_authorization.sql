-- State-specific authorization (Washington first).
--
-- Additive and backward compatible. filing_authorizations stays append-only: every
-- signature is a new row, so what the customer confirmed is never rewritten.
--   rule_version_id      the rule version the customer signed against
--   packet_snapshot      the exact filing packet shown before signing, in the state's
--                        portal order (section, state field, value)
--   packet_sha256        hash of that packet
--   facts_certified      the customer confirmed the packet is true and correct, knowing
--                        the filing agent will make the state's certification from it
--   certification_text   the state's own certification wording the agent will make
--   filing_agent_name    who the customer authorized (e.g. "Amary Coulibaly, sole proprietor")
--   registered_agent_consent  how the new registered agent's consent was given, when the
--                        answers change the agent; null when no consent is required
-- filing_documents gains kind 'registered_agent_consent' for a signed consent the
-- customer sends in (uploaded by staff; never created by Filewell).

alter table public.filing_authorizations
  add column if not exists rule_version_id uuid references public.state_rule_versions (id),
  add column if not exists packet_snapshot jsonb,
  add column if not exists packet_sha256 text check (packet_sha256 is null or packet_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists facts_certified boolean,
  add column if not exists certification_text text check (certification_text is null or char_length(certification_text) <= 2000),
  add column if not exists filing_agent_name text check (filing_agent_name is null or char_length(filing_agent_name) <= 300),
  add column if not exists registered_agent_consent jsonb;

alter table public.filing_documents drop constraint if exists filing_documents_kind_check;
alter table public.filing_documents add constraint filing_documents_kind_check check (kind in ('state_receipt', 'filed_report', 'acknowledgement',
  'filing_packet', 'customer_upload', 'registered_agent_consent', 'other'));
