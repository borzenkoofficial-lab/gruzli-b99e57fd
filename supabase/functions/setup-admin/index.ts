import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "admin@gruzli.app";
  const password = "GruzliAdmin2026!Secure";

  // Check if already exists
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing?.users?.find((u: any) => u.email === email);
  
  if (found) {
    return new Response(JSON.stringify({ message: "Admin account already exists", user_id: found.id }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create user
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Gruzli Official" },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const userId = newUser.user.id;

  // Update profile
  await supabaseAdmin.from("profiles").update({
    full_name: "Gruzli Official",
    avatar_url: "",
    verified: true,
  }).eq("user_id", userId);

  // Set admin role (handle_new_user trigger may have set 'worker', fix it)
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });

  return new Response(JSON.stringify({ message: "Admin account created", user_id: userId, email }), {
    headers: { "Content-Type": "application/json" },
  });
});
