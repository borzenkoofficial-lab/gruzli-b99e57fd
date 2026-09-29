import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, MessageCircle, Star, User, MapPin, Clock, Navigation, AlertTriangle, CheckCircle2, Crown, Search, Lock, Sparkles, Users, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SortKey = "newest" | "rating" | "experience" | "premium";

interface JobResponsesScreenProps {
  job: Tables<"jobs">;
  onBack: () => void;
  onChatWithWorker: (workerId: string, workerName: string) => void;
}

interface ResponseWithProfile {
  id: string;
  worker_id: string;
  status: string | null;
  worker_status: string | null;
  message: string | null;
  created_at: string;
  profile: Tables<"profiles"> | null;
}

const WORKER_STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  ready: { label: "Готов", icon: CheckCircle2, color: "text-green-500" },
  en_route: { label: "Выехал", icon: Navigation, color: "text-blue-500" },
  late: { label: "Опаздывает", icon: AlertTriangle, color: "text-yellow-500" },
  arrived: { label: "На месте", icon: MapPin, color: "text-primary" },
};

const JobResponsesScreen = ({ job: initialJob, onBack, onChatWithWorker }: JobResponsesScreenProps) => {
  const [job, setJob] = useState<Tables<"jobs">>(initialJob);
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("rating");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const fetchResponses = async () => {
    const { data } = await supabase
      .from("job_responses")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false });

    if (data) {
      const workerIds = [...new Set(data.map((r) => r.worker_id))];
      const { data: profiles } = workerIds.length > 0
        ? await supabase.from("profiles_public" as any).select("*").in("user_id", workerIds)
        : { data: [] };
      const pmap: Record<string, any> = {};
      ((profiles as any[]) || []).forEach((p) => { pmap[p.user_id] = p; });
      setResponses(data.map((r) => ({ ...r, profile: pmap[r.worker_id] || null })) as ResponseWithProfile[]);
    }
    setLoading(false);
  };

  const refreshJob = async () => {
    const { data } = await supabase.from("jobs").select("*").eq("id", job.id).single();
    if (data) setJob(data);
  };

  useEffect(() => {
    fetchResponses();

    const channel = supabase
      .channel(`job-responses-${job.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "job_responses", filter: `job_id=eq.${job.id}` },
        () => { fetchResponses(); }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${job.id}` },
        (p) => { setJob(p.new as any); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [job.id]);

  const acceptResponse = async (responseId: string) => {
    setAcceptingId(responseId);
    const { data, error } = await supabase.rpc("accept_job_response", { _response_id: responseId });
    setAcceptingId(null);
    if (error) {
      if (error.code === "P0002") {
        toast.error("Лимит грузчиков уже достигнут");
      } else {
        toast.error("Не удалось принять отклик: " + error.message);
      }
      return;
    }
    const result = data as any;
    const accepted = responses.find((r) => r.id === responseId);

    // Push notifications now handled by push4site (server-side via webhooks)


    if (result?.filled) {
      toast.success(`✅ Набор закрыт: ${result.accepted_count}/${result.workers_needed}. Заявка убрана из ленты, остальные отклики автоматически отклонены (${result.auto_rejected}).`, { duration: 5000 });
      // Auto-rejected workers will be notified server-side

    } else {
      toast.success(`Грузчик принят (${result?.accepted_count}/${result?.workers_needed})`);
    }

    await Promise.all([fetchResponses(), refreshJob()]);
  };

  const rejectResponse = async (responseId: string) => {
    const { error } = await supabase.rpc("dispatcher_reject_job_response", {
      _response_id: responseId,
    });
    if (error) { toast.error(error.code === "P0001" ? "Этот отклик уже нельзя отклонить" : "Не удалось отклонить"); return; }
    setResponses((prev) => prev.map((x) => (x.id === responseId ? { ...x, status: "rejected" } : x)));
    toast.success("Отклик отклонён");

  };

  const acceptTopMatching = async () => {
    const limit = job.workers_needed || 1;
    const acceptedNow = responses.filter((r) => r.status === "accepted").length;
    const slotsLeft = limit - acceptedNow;
    if (slotsLeft <= 0) { toast.info("Все места уже заняты"); return; }

    const candidates = [...responses]
      .filter((r) => r.status === "pending")
      .sort((a, b) => {
        const aScore = (a.profile?.is_premium ? 100 : 0) + Number(a.profile?.rating || 0) * 10 + (a.profile?.completed_orders || 0) / 10;
        const bScore = (b.profile?.is_premium ? 100 : 0) + Number(b.profile?.rating || 0) * 10 + (b.profile?.completed_orders || 0) / 10;
        return bScore - aScore;
      })
      .slice(0, slotsLeft);

    if (candidates.length === 0) { toast.info("Нет ожидающих откликов"); return; }

    for (const c of candidates) {
      // serially to leverage atomic check
      // eslint-disable-next-line no-await-in-loop
      await acceptResponse(c.id);
    }
  };

  const filteredResponses = useMemo(() => {
    let list = responses;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => (r.profile?.full_name || "").toLowerCase().includes(q));
    }
    return list;
  }, [responses, search]);

  const sortedPending = useMemo(() => {
    const pending = filteredResponses.filter((r) => r.status === "pending");
    const sorted = [...pending];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return Number(b.profile?.rating || 0) - Number(a.profile?.rating || 0);
        case "experience":
          return (b.profile?.completed_orders || 0) - (a.profile?.completed_orders || 0);
        case "premium":
          return (b.profile?.is_premium ? 1 : 0) - (a.profile?.is_premium ? 1 : 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [filteredResponses, sortBy]);

  // Separate accepted and rejected
  const accepted = responses.filter((r) => r.status === "accepted");
  const rejected = filteredResponses.filter((r) => r.status === "rejected");
  const withdrawn = filteredResponses.filter((r) => r.status === "withdrawn");
  const limit = job.workers_needed || 1;
  const slotsLeft = Math.max(0, limit - accepted.length);
  const isFilled = job.status === "filled" || slotsLeft === 0;
  const progressPct = Math.min(100, Math.round((accepted.length / limit) * 100));

  const sortChips: { key: SortKey; label: string }[] = [
    { key: "rating", label: "По рейтингу" },
    { key: "experience", label: "По опыту" },
    { key: "premium", label: "Premium" },
    { key: "newest", label: "Новые" },
  ];

  return (
    <div className="min-h-screen bg-background pb-8" aria-busy={loading}>
      <span className="sr-only" role="status" aria-live="polite">{loading ? "Загружаем отклики" : `${responses.length} откликов загружено`}</span>
      <div className="flex items-center gap-3 px-4 safe-top pb-3">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">Набор</h1>
          <p className="text-xs text-muted-foreground truncate">{job.title}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-3">
        <div className={`rounded-2xl p-3.5 border ${isFilled ? "bg-green-500/10 border-green-500/30" : "bg-card border-border"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={14} className={isFilled ? "text-green-500" : "text-primary"} />
              <span className={`text-sm font-bold ${isFilled ? "text-green-500" : "text-foreground"}`}>
                {accepted.length} / {limit} грузчиков
              </span>
              {isFilled && <Lock size={12} className="text-green-500" />}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {isFilled ? "Набор закрыт" : `Осталось ${slotsLeft} мест`}
            </span>
          </div>
          <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4 }}
              className={`h-full rounded-full ${isFilled ? "bg-green-500" : "bg-primary"}`}
            />
          </div>
          {isFilled && (
            <p className="text-[10px] text-green-500/80 mt-2">Заявка автоматически убрана из общей ленты.</p>
          )}
        </div>
      </div>

      {/* Search + sort + smart action */}
      {responses.length > 0 && !loading && (
        <div className="px-4 mb-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск откликов по имени грузчика"
              placeholder="Поиск по имени"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {sortChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setSortBy(c.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  sortBy === c.key ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {!isFilled && sortedPending.length > 1 && slotsLeft > 0 && (
            <button
              onClick={acceptTopMatching}
              disabled={acceptingId !== null}
              className="w-full py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed bg-primary/10 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center gap-2 active:bg-primary/20 transition-all"
            >
              <Sparkles size={13} /> Принять {Math.min(slotsLeft, sortedPending.length)} лучших автоматически
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : responses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Пока нет откликов</div>
      ) : (
        <div className="px-4 space-y-4">
          {/* Accepted workers with live status */}
          {accepted.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> Выбранные исполнители ({accepted.length})
              </h3>
              <div className="space-y-3">
                {accepted.map((r) => {
                  const ws = r.worker_status ? WORKER_STATUS_MAP[r.worker_status] : null;
                  const WsIcon = ws?.icon;
                  return (
                    <motion.div key={r.id} layout className="bg-card rounded-2xl p-4 border border-primary/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          {r.profile?.is_premium && (
                            <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 animate-pulse opacity-80" />
                          )}
                          {r.profile?.avatar_url ? (
                            <img src={r.profile.avatar_url} alt="" className="relative w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="relative w-12 h-12 rounded-full bg-foreground flex items-center justify-center text-primary-foreground font-bold">
                              {(r.profile?.full_name || "?")[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-foreground">{r.profile?.full_name || "Грузчик"}</h3>
                            {r.profile?.is_premium && <Crown size={13} className="text-yellow-500 fill-yellow-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Star size={12} className="text-primary fill-primary" />
                            <span className="text-xs text-foreground">{r.profile?.rating || "5.00"}</span>
                            <span className="text-xs text-muted-foreground">· {r.profile?.completed_orders || 0} зак.</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-1 border border-border rounded-xl p-3 mb-3">
                        <p className="text-[10px] text-muted-foreground mb-1.5">Статус исполнителя</p>
                        {ws && WsIcon ? (
                          <div className="flex items-center gap-2">
                            <WsIcon size={16} className={ws.color} />
                            <span className={`text-sm font-bold ${ws.color}`}>{ws.label}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ожидает подтверждения</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => onChatWithWorker(r.worker_id, r.profile?.full_name || "Грузчик")}
                          className="flex-1 py-3 rounded-xl bg-card border border-border flex items-center justify-center gap-2 active:bg-surface-1 transition-all"
                        >
                          <MessageCircle size={14} className="text-primary" />
                          <span className="text-sm font-semibold text-foreground">Написать</span>
                        </button>
                        {r.profile?.phone && (
                          <a href={`tel:${r.profile.phone}`} className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all">
                            <Phone size={16} className="text-green-500" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending */}
          <AnimatePresence>
            {!isFilled && sortedPending.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-muted-foreground">Ожидают выбора ({sortedPending.length})</h3>
                </div>
                <div className="space-y-3">
                  {sortedPending.map((r, i) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(i, 6) * 0.04 }}
                      className="bg-card border border-border rounded-2xl shadow-sm p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          {r.profile?.is_premium && (
                            <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 animate-pulse opacity-80" />
                          )}
                          {r.profile?.avatar_url ? (
                            <img src={r.profile.avatar_url} alt="" className="relative w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="relative w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
                              <User size={20} className="text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-foreground">{r.profile?.full_name || "Грузчик"}</h3>
                            {r.profile?.is_premium && <Crown size={13} className="text-yellow-500 fill-yellow-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Star size={12} className="text-primary fill-primary" />
                            <span className="text-xs text-foreground">{r.profile?.rating || "5.00"}</span>
                            <span className="text-xs text-muted-foreground">· {r.profile?.completed_orders || 0} заказов</span>
                          </div>
                        </div>
                      </div>

                      {r.message && (
                        <p className="text-xs text-muted-foreground mb-3 bg-surface-1 border border-border rounded-xl px-3 py-2">{r.message}</p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptResponse(r.id)}
                          disabled={acceptingId === r.id || slotsLeft <= 0}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-semibold tap-scale disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {acceptingId === r.id ? <Clock size={14} className="animate-spin" /> : <Check size={14} />} Выбрать
                        </button>
                        <button
                          onClick={() => rejectResponse(r.id)}
                          disabled={acceptingId !== null}
                          aria-label={`Отклонить отклик ${r.profile?.full_name || "грузчика"}`}
                          className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Отклонить"
                        >
                          <X size={16} className="text-destructive" />
                        </button>
                        <button
                          onClick={() => onChatWithWorker(r.worker_id, r.profile?.full_name || "Грузчик")}
                          className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all"
                        >
                          <MessageCircle size={16} className="text-primary" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rejected / Withdrawn */}
          {(rejected.length > 0 || withdrawn.length > 0) && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground/50 mb-2">
                Не приняты ({rejected.length + withdrawn.length})
              </h3>
              <div className="space-y-2">
                {[...rejected, ...withdrawn].map((r) => (
                  <div key={r.id} className="bg-card border border-border rounded-2xl p-3 opacity-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center">
                        <User size={16} className="text-muted-foreground" />
                      </div>
                      <span className="flex-1 text-sm text-muted-foreground truncate">{r.profile?.full_name || "Грузчик"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {r.status === "withdrawn" ? "отозван" : "отклонён"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobResponsesScreen;