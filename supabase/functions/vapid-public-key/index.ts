const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const repairVapidPublicKey = (key: string) => {
  // Текущий сохранённый публичный VAPID-ключ обрезан на один символ: браузеру нужен
  // uncompressed P-256 ключ длиной 65 байт. Восстанавливаем известный пропущенный символ.
  if (key === "BAFIgs6_EbZXaym4QUAl-10E5i4yh6gkoJh8VZ9jfgeS-6nkAYAs1AcN3WPy081bsDHAbDAq9nCUKRWmPGz3MY") {
    return "BAFIgs6_EbZXaym4QUAl-10E5i4yh6gkoJh8VZ9jfgeS-6nkAYAs1AcN3W-Py081bsDHAbDAq9nCUKRWmPGz3MY";
  }
  return key;
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ key: repairVapidPublicKey(Deno.env.get("VAPID_PUBLIC_KEY") ?? "") }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
