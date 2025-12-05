CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- TABLE: leads

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owner_id UUID NOT NULL,
    stage TEXT NOT NULL DEFAULT 'new',
    name TEXT NOT NULL,
    email TEXT
);
-- TABLE: applications

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft'
);
-- TABLE: tasks

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    related_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    CONSTRAINT check_due_date_future CHECK (due_at >= created_at),
    CONSTRAINT check_task_type CHECK (type IN ('call', 'email', 'review'))
);

-- TABLE: teams

CREATE TABLE IF NOT EXISTS teams (
    team_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
);
--  TABLE: user_teams

CREATE TABLE IF NOT EXISTS user_teams (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, team_id)
);
-- INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_owner_stage ON leads(owner_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_lead_id ON applications(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_today ON tasks(due_at) WHERE is_complete = FALSE;
-- ENABLE RLS

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
