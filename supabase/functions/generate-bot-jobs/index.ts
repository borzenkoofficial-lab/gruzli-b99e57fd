import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

const FAKE_NAMES = [
  "Алексей Петров", "Дмитрий Козлов", "Иван Смирнов", "Сергей Волков",
  "Михаил Новиков", "Андрей Морозов", "Николай Лебедев", "Павел Соколов",
  "Олег Егоров", "Роман Захаров", "Артём Кузнецов", "Виктор Попов",
  "Максим Васильев", "Юрий Фёдоров", "Константин Орлов", "Владимир Макаров",
  "Геннадий Зайцев", "Анатолий Павлов", "Вадим Семёнов", "Борис Голубев",
];

const FAKE_ADDRESSES = [
  "ул. Тверская, 12", "Ленинский пр-т, 45", "ул. Арбат, 8",
  "пр-т Мира, 101", "ул. Пятницкая, 33", "ул. Бауманская, 20",
  "Кутузовский пр-т, 57", "ул. Профсоюзная, 78", "Варшавское шоссе, 134",
  "ул. Новослободская, 15", "Дмитровское шоссе, 40", "ул. Щербаковская, 22",
  "пр-т Вернадского, 86", "ул. Покровка, 17", "Рязанский пр-т, 55",
  "ул. Бол. Якиманка, 24", "Каширское шоссе, 65", "ул. Маросейка, 9",
  "Нахимовский пр-т, 31", "ул. Сретенка, 14",
];

const METRO_STATIONS = [
  "Тверская", "Ленинский проспект", "Арбатская", "ВДНХ", "Новокузнецкая",
  "Бауманская", "Кутузовская", "Профсоюзная", "Варшавская", "Менделеевская",
  "Тимирязевская", "Щёлковская", "Юго-Западная", "Китай-город", "Рязанский проспект",
  "Полянка", "Каширская", "Лубянка", "Нахимовский проспект", "Сретенский бульвар",
];

const JOB_TITLES = [
  "Разгрузка фуры с товаром", "Погрузка офисной мебели", "Переезд склада",
  "Разгрузка стройматериалов", "Погрузка оборудования", "Перенос коробок на этаж",
  "Разборка и погрузка мебели", "Выгрузка паллет", "Погрузка бытовой техники",
  "Переезд квартиры", "Разгрузка контейнера", "Сортировка и погрузка товаров",
  "Перенос стройматериалов", "Загрузка грузовика", "Разгрузка продуктов",
];

const JOB_DESCRIPTIONS = [
  "Нужны аккуратные и ответственные грузчики. Груз тяжёлый, нужна физическая подготовка.",
  "Работа на складе, перенос коробок. Есть лифт. Оплата сразу после смены.",
  "Срочно нужны 2-3 человека на разгрузку. Работа на 3-4 часа. Оплата на руки.",
  "Переезд офиса. Нужно аккуратно упаковать и перенести мебель. Есть грузовой лифт.",
  "Разгрузка строительных материалов на объекте. Каска и перчатки предоставляются.",
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if bot jobs are enabled
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("id", "bot_jobs_enabled")
      .single();

    // Allow manual generation even if disabled (admin clicked "generate now")
    const body = await req.json().catch(() => ({}));
    const count = Math.min(body.count || 3, 10);

    // Get a random admin/dispatcher to use as dispatcher_id
    const { data: dispatchers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["dispatcher", "admin"])
      .limit(10);

    const dispatcherIds = dispatchers?.map((d) => d.user_id) || [];
    if (dispatcherIds.length === 0) {
      return new Response(JSON.stringify({ error: "No dispatchers found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobs = [];
    for (let i = 0; i < count; i++) {
      const hoursAgo = randInt(1, 6);
      const startTime = new Date(Date.now() - hoursAgo * 3600000);
      const rate = randInt(5, 12) * 50; // 250-600 step 50
      const idx = Math.floor(Math.random() * FAKE_ADDRESSES.length);

      jobs.push({
        title: rand(JOB_TITLES),
        description: rand(JOB_DESCRIPTIONS),
        dispatcher_id: rand(dispatcherIds),
        hourly_rate: rate,
        address: FAKE_ADDRESSES[idx],
        metro: METRO_STATIONS[idx],
        start_time: startTime.toISOString(),
        duration_hours: randInt(2, 8),
        workers_needed: randInt(1, 5),
        urgent: Math.random() > 0.7,
        quick_minimum: Math.random() > 0.8,
        status: "active",
        is_bot: true,
      });
    }

    const { error } = await supabase.from("jobs").insert(jobs);
    if (error) throw error;

    return new Response(JSON.stringify({ generated: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
