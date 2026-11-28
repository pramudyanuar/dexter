begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('dexter-transfer', 'dexter-transfer', false, 50000000);

-- Keep this bucket private even if the project has a broader Storage policy.
create policy dexter_transfer_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'dexter-transfer')
with check (bucket_id <> 'dexter-transfer');

commit;
