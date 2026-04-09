import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, MessageCircle, Star, User, MapPin, Clock, Navigation, AlertTriangle, CheckCircle2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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

const JobResponsesScreen = ({ job, onBack, onChatWithWorker }: JobResponsesScreenProps) => {
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResponses = async () => {
    const { data } = await supabase
      .from("job_responses")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false });

    if (data) {
      const withProfiles = await Promise.all(
        data.map(async (r) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", r.worker_id)
            .single();
          return { ...r, profile } as ResponseWithProfile;
        })
      );
      setResponses(withProfiles);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchResponses();

    // Realtime subscription for worker_status changes
    const channel = supabase
      .channel(`job-responses-${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "job_responses", filter: `job_id=eq.${job.id}` },
        (payload) => {
          const updated = payload.new as any;
          setResponses((prev) =>
            prev.map((r) =>
              r.id === updated.id ? { ...r, status: updated.status, worker_status: updated.worker_status } : r
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [job.id]);

  const updateStatus = async (responseId: string, status: string) => {
    const { error } = await supabase
      .from("job_responses")
      .update({ status })
      .eq("id", responseId);
    if (!error) {
      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, status } : r))
      );
      toast.success(status === "accepted" ? "Грузчик выбран!" : "Отклик отклонён");
    }
  };

  // Separate accepted and pending
  const accepted = responses.filter((r) => r.status === "accepted");
  const pending = responses.filter((r) => r.status === "pending");
  const rejected = responses.filter((r) => r.status === "rejected");

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Отклики</h1>
          <p className="text-xs text-muted-foreground">{job.title}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : responses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Пока нет откликов</div>
      ) : (
        <div className="px-5 space-y-4">
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
                    <motion.div key={r.id} layout className="neu-card rounded-2xl p-4 border border-primary/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          {r.profile?.is_premium && (
                            <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 animate-pulse opacity-80" />
                          )}
                          <div className="relative w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                            {(r.profile?.full_name || "?")[0]}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-foreground">{r.profile?.full_name || "Грузчик"}</h3>
                            {r.profile?.is_premium && <Crown size={13} className="text-yellow-500 fill-yellow-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Star size={12} className="text-primary fill-primary" />
                            <span className="text-xs text-foreground">{r.profile?.rating || "5.00"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Worker live status */}
                      <div className="neu-inset rounded-xl p-3 mb-3">
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

                      <button
                        onClick={() => onChatWithWorker(r.worker_id, r.profile?.full_name || "Грузчик")}
                        className="w-full py-3 rounded-xl neu-raised flex items-center justify-center gap-2 active:neu-inset transition-all"
                      >
                        <MessageCircle size={14} className="text-primary" />
                        <span className="text-sm font-semibold text-foreground">Написать</span>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending responses */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">Ожидают выбора ({pending.length})</h3>
              <div className="space-y-3">
                {pending.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="neu-card rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        {r.profile?.is_premium && (
                          <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 animate-pulse opacity-80" />
                        )}
                        <div className="relative w-12 h-12 rounded-full neu-raised flex items-center justify-center">
                          <User size={20} className="text-muted-foreground" />
                        </div>
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
                      <p className="text-xs text-muted-foreground mb-3 neu-inset rounded-xl px-3 py-2">{r.message}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(r.id, "accepted")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform"
                      >
                        <Check size={14} /> Выбрать
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "rejected")}
                        className="w-12 h-12 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all"
                      >
                        <X size={16} className="text-destructive" />
                      </button>
                      <button
                        onClick={() => onChatWithWorker(r.worker_id, r.profile?.full_name || "Грузчик")}
                        className="w-12 h-12 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all"
                      >
                        <MessageCircle size={16} className="text-primary" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected */}
          {rejected.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground/50 mb-2">Отклонённые ({rejected.length})</h3>
              <div className="space-y-2">
                {rejected.map((r) => (
                  <div key={r.id} className="neu-card rounded-2xl p-3 opacity-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full neu-raised flex items-center justify-center">
                        <User size={16} className="text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">{r.profile?.full_name || "Грузчик"}</span>
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