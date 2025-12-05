-- Admins can read all leads
CREATE POLICY "admins can read all leads"
ON leads
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'admin'
);

-- Counselors can read leads assigned to themselves OR their team
CREATE POLICY "counselors read own or team leads"
ON leads
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'counselor' AND (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM user_teams ut_c
            JOIN user_teams ut_o ON ut_c.team_id = ut_o.team_id
            WHERE ut_c.user_id = auth.uid()      -- counselor
              AND ut_o.user_id = leads.owner_id -- owner of lead
        )
    )
);

-- Admins can insert any lead
CREATE POLICY "admins insert leads"
ON leads
FOR INSERT
TO authenticated
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Counselors can insert leads only assigned to themselves
CREATE POLICY "counselors insert own leads"
ON leads
FOR INSERT
TO authenticated
WITH CHECK (
    auth.jwt() ->> 'role' = 'counselor'
    AND owner_id = auth.uid()
);
