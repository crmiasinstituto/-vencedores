-- Fix stuck meetings that are in_progress but clearly abandoned
UPDATE meetings 
SET status = 'completed', 
    ended_at = COALESCE(ended_at, now()), 
    duration_seconds = CASE 
      WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - started_at))::int 
      ELSE 0 
    END
WHERE id IN ('85831c84-5f5f-4b27-b3b0-38fd2175ed4b', '0c011fa4-2541-440e-abb3-300caf4890ab') 
  AND status = 'in_progress';