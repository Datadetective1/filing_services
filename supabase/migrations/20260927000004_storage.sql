-- Private document storage. No storage policies are granted to anon/authenticated:
-- every upload and download goes through server code that authorizes the actor and
-- then uses the service role (downloads are short-lived signed URLs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('filing-documents', 'filing-documents', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
