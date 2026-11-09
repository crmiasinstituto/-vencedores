create index concurrently if not exists idx_crm_activities_automation_error
  on public.crm_activities ((metadata->>'automation_id'))
  where activity_type = 'automation_error';
