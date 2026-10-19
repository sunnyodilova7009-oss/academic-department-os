import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Please sign in as the owner first." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Admin invitations are not configured." }, 500);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Your sign-in has expired. Sign in again." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerProfile, error: profileError } = await admin
    .from("profiles").select("role, active").eq("id", authData.user.id).maybeSingle();
  if (profileError) return json({ error: "Could not verify owner access." }, 500);
  if (!callerProfile?.active || callerProfile.role !== "owner_admin") {
    return json({ error: "Only the active owner can invite admins." }, 403);
  }

  let body: { email?: unknown; fullName?: unknown };
  try { body = await request.json(); } catch { return json({ error: "Enter a valid email and full name." }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 120) {
    return json({ error: "Enter a valid email and a name under 120 characters." }, 400);
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: "https://academic-department-os.onrender.com/?setup=invite",
  });
  if (inviteError || !inviteData.user) return json({ error: inviteError?.message || "Could not send invitation." }, 400);

  const profile = { id: inviteData.user.id, full_name: fullName, role: "academic_admin", active: true };
  const { error: insertError } = await admin.from("profiles").insert(profile);
  if (insertError) {
    await admin.auth.admin.deleteUser(inviteData.user.id);
    return json({ error: `Invitation setup failed, so the new account was removed. ${insertError.message}` }, 500);
  }
  return json({ profile });
});

