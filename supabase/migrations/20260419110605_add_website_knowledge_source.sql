alter table public.knowledge_sources drop constraint knowledge_sources_source_type_check;
alter table public.knowledge_sources add constraint knowledge_sources_source_type_check check (source_type in ('text', 'file', 'website'));

alter table public.knowledge_sources drop constraint knowledge_sources_text_requires_raw_text;
alter table public.knowledge_sources add constraint knowledge_sources_content_check check (
  (source_type in ('text', 'website') and raw_text is not null and storage_path is null)
  or (source_type = 'file' and raw_text is null and storage_path is not null)
);