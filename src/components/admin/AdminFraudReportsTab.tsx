import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, Check, Trash2, RefreshCw } from "lucide-react";

interface Report {
  id: string;
  reporter_id: string;
  job_id: string | null;
  dispatcher_id: string | null;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface ProfileMini {
  user_id: string;
  full_name: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  in_review: "В работе",
  resolved: "Решена",
  rejected: "Отклонена",
};

export const AdminFraudReportsTab = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fraud_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Ошибка загрузки жалоб");
      setLoading(false);
      return;
    }
    const list = (data || []) as Report[];
    setReports(list);

    const userIds = Array.from(
      new Set(list.flatMap((r) => [r.reporter_id, r.dispatcher_id]).filter(Boolean) as string[])
    );
    const jobIds = Array.from(new Set(list.map((r) => r.job_id).filter(Boolean) as string[]));

    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      (profs as ProfileMini[] | null)?.forEach((p) => {
        map[p.user_id] = p.full_name || "—";
      });
      setProfiles(map);
    }
    if (jobIds.length) {
      const { data: js } = await supabase.from("jobs").select("id, title").in("id", jobIds);
      const m: Record<string, string> = {};
      (js as any[] | null)?.forEach((j) => {
        m[j.id] = j.title;
      });
      setJobs(m);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fraud_reports")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: u.user?.id ?? null })
      .eq("id", id);
    if (error) {
      toast.error("Не удалось обновить");
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success("Статус обновлён");
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить жалобу?")) return;
    const { error } = await supabase.from("fraud_reports").delete().eq("id", id);
    if (error) {
      toast.error("Не удалось удалить");
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const counts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-bold">Жалобы на мошенников</h2>
          <span className="text-xs text-muted-foreground">({reports.length})</span>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs flex items-center gap-1.5 hover:bg-muted/40"
        >
          <RefreshCw size={13} /> Обновить
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: "all", label: "Все" },
          { id: "new", label: `Новые (${counts.new || 0})` },
          { id: "in_review", label: `В работе (${counts.in_review || 0})` },
          { id: "resolved", label: `Решены (${counts.resolved || 0})` },
          { id: "rejected", label: `Отклонены (${counts.rejected || 0})` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-foreground/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Жалоб пока нет</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{r.reason}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                    r.status === "new"
                      ? "bg-destructive/15 text-destructive"
                      : r.status === "in_review"
                      ? "bg-amber-500/15 text-amber-600"
                      : r.status === "resolved"
                      ? "bg-online/15 text-online"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>

              {r.details && (
                <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-snug">
                  {r.details}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60">
                <div>
                  <p className="text-muted-foreground">Жалобщик</p>
                  <p className="text-foreground font-medium truncate">
                    {profiles[r.reporter_id] || r.reporter_id.slice(0, 8)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Диспетчер</p>
                  <p className="text-foreground font-medium truncate">
                    {r.dispatcher_id
                      ? profiles[r.dispatcher_id] || r.dispatcher_id.slice(0, 8)
                      : "—"}
                  </p>
                </div>
                {r.job_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Заказ</p>
                    <p className="text-foreground font-medium truncate">
                      {jobs[r.job_id] || r.job_id.slice(0, 8)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {r.status !== "in_review" && (
                  <button
                    onClick={() => setStatus(r.id, "in_review")}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 text-xs font-semibold"
                  >
                    В работу
                  </button>
                )}
                {r.status !== "resolved" && (
                  <button
                    onClick={() => setStatus(r.id, "resolved")}
                    className="px-3 py-1.5 rounded-lg bg-online/15 text-online text-xs font-semibold flex items-center gap-1"
                  >
                    <Check size={12} /> Решить
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    onClick={() => setStatus(r.id, "rejected")}
                    className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold"
                  >
                    Отклонить
                  </button>
                )}
                <button
                  onClick={() => remove(r.id)}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 size={12} /> Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFraudReportsTab;
