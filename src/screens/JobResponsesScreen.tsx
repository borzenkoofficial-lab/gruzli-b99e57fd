import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, MessageCircle, Star, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  message: string | null;
  created_at: string;
  profile: Tables<"profiles"> | null;
}

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
          return { ...r, profile };
        })
      );
      setResponses(withProfiles);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchResponses();
  }, []);

  const updateStatus = async (responseId: string, status: string) => {
    const { error } = await supabase
      .from("job_responses")
      .update({ status })
      .eq("id", responseId);
    if (!error) {
      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, status } : r))
      );
      toast.success(status === "accepted" ? "Грузчик принят!" : "Отклик отклонён");
    }
  };

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
        <div className="px-5 space-y-3">
          {responses.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="neu-card rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full neu-raised flex items-center justify-center">
                  <User size={20} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">
                    {r.profile?.full_name || "Грузчик"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star size={12} className="text-primary fill-primary" />
                    <span className="text-xs text-foreground">{r.profile?.rating || "5.00"}</span>
                    <span className="text-xs text-muted-foreground">· {r.profile?.completed_orders || 0} заказов</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
                  r.status === "accepted" ? "bg-online/15 text-online" :
                  r.status === "rejected" ? "bg-destructive/15 text-destructive" :
                  "bg-primary/15 text-primary"
                }`}>
                  {r.status === "accepted" ? "Принят" : r.status === "rejected" ? "Отклонён" : "Ожидает"}
                </span>
              </div>

              {r.message && (
                <p className="text-xs text-muted-foreground mb-3 neu-inset rounded-xl px-3 py-2">{r.message}</p>
              )}

              <div className="flex gap-2">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(r.id, "accepted")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform"
                    >
                      <Check size={14} /> Принять
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "rejected")}
                      className="w-12 h-12 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all"
                    >
                      <X size={16} className="text-destructive" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => onChatWithWorker(r.worker_id, r.profile?.full_name || "Грузчик")}
                  className={`${r.status === "pending" ? "w-12 h-12" : "flex-1 py-3"} rounded-xl neu-raised flex items-center justify-center gap-2 active:neu-inset transition-all`}
                >
                  <MessageCircle size={16} className="text-primary" />
                  {r.status !== "pending" && <span className="text-sm font-semibold text-foreground">Написать</span>}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobResponsesScreen;
