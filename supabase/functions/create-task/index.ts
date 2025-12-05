import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS Preflight (Browser requests)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Initialize Supabase Client
    // Uses the Service Role Key to bypass RLS for administrative tasks like fetching tenant_id
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Server misconfiguration: Missing Supabase Environment Variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Parse & Validate Input
    const { application_id, task_type, due_at, title, description } = await req.json();

    // Validation A: Required Fields
    if (!application_id) {
      return new Response(JSON.stringify({ error: "Missing required field: application_id" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validation B: Task Type (Requirement: call, email, review)
    const validTypes = ['call', 'email', 'review'];
    if (task_type && !validTypes.includes(task_type)) {
      return new Response(JSON.stringify({ error: "Invalid task_type. Must be: call, email, or review" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validation C: Future Date (Requirement: due_at > now)
    const dueDate = new Date(due_at);
    if (isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) {
      return new Response(JSON.stringify({ error: "due_at must be a valid date in the future" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch Tenant ID (Critical for Data Integrity)
    // We fetch this from the parent application to ensure the task belongs to the same tenant.
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('tenant_id')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Insert Task
    const { data: task, error: insertError } = await supabase
      .from('tasks')
      .insert([
        { 
          tenant_id: application.tenant_id, // Inherited from parent app
          related_id: application_id,
          type: task_type || 'call',
          due_at: due_at,
          description: description || title || `New ${task_type} task`,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error("DB Insert Error:", insertError);
      throw insertError;
    }

    // 6. Emit Realtime Broadcast
    // Frontends listening to 'task.created' will update immediately
    await supabase.channel('tasks-channel').send({
      type: 'broadcast',
      event: 'task.created',
      payload: { task },
    });

    // 7. Return Success
    return new Response(JSON.stringify({ success: true, task_id: task.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});