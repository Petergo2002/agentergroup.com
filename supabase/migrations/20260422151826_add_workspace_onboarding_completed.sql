-- Add onboarding_completed flag to workspaces
-- Existing workspaces are assumed to have completed onboarding (or at least we don't want to force them through it now)
-- New workspaces will default to false, so the user is forced to pick a plan or click "Free".

ALTER TABLE public.workspaces 
ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT true;

-- For future workspaces, the default should be false so they go through onboarding.
-- We alter the default AFTER adding the column so existing rows get 'true'.
ALTER TABLE public.workspaces 
ALTER COLUMN onboarding_completed SET DEFAULT false;
