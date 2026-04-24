import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Crown, Phone, MessageCircle, Users, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TopWorker {
  workerId: string;
  fullName: string;
  avatarUrl: string | null;
  isPremium: boolean;
  rating: number;
  jobsWithMe: number;
  totalEarned: number;
  avgReview: number | null;
  phone: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onChat: (workerId: string, workerName: string) => void;
  onViewProfile?: (workerId: string) => void;
}

const TopWorkersModal = ({ open, onClose, onChat, onViewProfile }: Props) => {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<TopWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      // get my completed responses
      const { data: myJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("dispatcher_id", user.id);
      const jobIds = (myJobs || []).map((j) => j.id);
      if (jobIds.length === 0) { setWorkers([]); setLoading(false); return; }

      const { data: resps } = await supabase
        .from("job_responses")
        .select("worker_id, earned, dispatcher_review_rating, worker_status")
        .in("job_id", jobIds)
        .eq("status", "accepted");

      const map: Record<string, { count: number; earned: number; ratings: number[] }> = {};
      (resps || []).forEach((r) => {
        if (r.worker_status !== "completed") return;
        const w = map[r.worker_id] || { count: 0, earned: 0, ratings: [] };
        w.count += 1;
        w.earned += (r.earned as number) || 0;
        if (r.dispatcher_review_rating) w.ratings.push(r.dispatcher_review_rating);
        map[r.worker_id] = w;
      });

      const ids = Object.keys(map);
      if (ids.length === 0) { setWorkers([]); setLoading(false); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, is_premium, rating, phone")
        .in("user_id", ids);

      const list: TopWorker[] = (profiles || []).map((p) => {
        const m = map[p.user_id];
        const avg = m.ratings.length ? m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length : null;
        return {
          workerId: p.user_id,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
          isPremium: p.is_premium,
          rating: Number(p.rating) || 5,
          jobsWithMe: m.count,
          totalEarned: m.earned,
          avgReview: avg,
          phone: p.phone,
        };
      });
      list.sort((a, b) => {
        const sa = (a.avgReview || a.rating) * Math.log(a.jobsWithMe + 1);
        const sb = (b.avgReview || b.rating) * Math.log(b.jobsWithMe + 1);
        return sb - sa;
      });
      setWorkers(list.slice(0, 30));
      setLoading(false);
    };
    load();
  }, [open, user?.id]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-card px-5 pt-3 pb-2 border-b border-border z-10">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-500" /> Топ ваших грузчиков
                </h3>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Лучшие исполнители по работе с вами</p>
            </div>

            <div className="p-4 space-y-2">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
              ) : workers.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  Пока нет данных по грузчикам
                </div>
              ) : (
                workers.map((w, i) => {
                  const initials = w.fullName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={w.workerId} className="bg-surface-1 border border-border rounded-2xl p-3 flex items-center gap-3">
                      <div className="relative shrink-0">
                        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-foreground text-primary-foreground text-[10px] font-extrabold flex items-center justify-center z-10">{i + 1}</span>
                        <button onClick={() => onViewProfile?.(w.workerId)}>
                          {w.avatarUrl ? (
                            <img src={w.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-foreground text-primary-foreground text-sm font-bold flex items-center justify-center">{initials}</div>
                          )}
                        </button>
                      </div>
                      <button onClick={() => onViewProfile?.(w.workerId)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground truncate">{w.fullName}</span>
                          {w.isPremium && <Crown size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-0.5"><Star size={10} className="text-yellow-500 fill-yellow-500" /> {(w.avgReview || w.rating).toFixed(1)}</span>
                          <span>·</span>
                          <span>{w.jobsWithMe} с вами</span>
                          {w.totalEarned > 0 && <><span>·</span><span className="text-green-500">{w.totalEarned.toLocaleString("ru-RU")} ₽</span></>}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => onChat(w.workerId, w.fullName)} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <MessageCircle size={14} className="text-primary" />
                        </button>
                        {w.phone && (
                          <a href={`tel:${w.phone}`} className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <Phone size={14} className="text-green-500" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TopWorkersModal;
