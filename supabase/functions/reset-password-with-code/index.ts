import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const phoneToEmail = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@phone.gruzli.app`;
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { identifier, recovery_code, new_password } = await req.json();

    if (!identifier || !recovery_code || !new_password) {
      return new Response(JSON.stringify({ error: "Заполните все поля" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Пароль должен быть не менее 6 символов" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(recovery_code).trim().toUpperCase();
    const id = String(identifier).trim();
    const email = isEmail(id) ? id.toLowerCase() : phoneToEmail(id);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Find user by email
    const { data: userData, error: userErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (userErr) throw userErr;
    const user = userData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return new Response(JSON.stringify({ error: "Пользователь не найден" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify recovery code
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("recovery_code")
      .eq("user_id", user.id)
      .single();

    if (profErr || !profile) {
      return new Response(JSON.stringify({ error: "Профиль не найден" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.recovery_code || profile.recovery_code.toUpperCase() !== code) {
      return new Response(JSON.stringify({ error: "Неверный код восстановления" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update password
    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password: new_password });
    if (updErr) throw updErr;

    // Rotate recovery code (one-time use)
    const { data: newCodeData } = await admin.rpc("generate_recovery_code");
    if (newCodeData) {
      await admin.from("profiles").update({ recovery_code: newCodeData }).eq("user_id", user.id);
    }

    return new Response(JSON.stringify({ success: true, new_recovery_code: newCodeData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reset-password-with-code error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ошибка" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
