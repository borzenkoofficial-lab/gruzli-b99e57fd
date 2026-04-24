import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Copy, Trash2, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface JobTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  hourly_rate: number;
  duration_hours: number | null;
  workers_needed: number | null;
  metro: string | null;
  address: string | null;
  urgent: boolean | null;
  quick_minimum: boolean | null;
  use_count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const JobTemplatesModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // form
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("");
  const [duration, setDuration] = useState("4");
  const [workers, setWorkers] = useState("1");
  const [metro, setMetro] = useState("");
  const [address, setAddress] = useState("");

  const fetchTemplates = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("job_templates")
      .select("*")
      .eq("dispatcher_id", user.id)
      .order("use_count", { ascending: false });
    setTemplates((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, user?.id]);

  const handleCreate = async () => {
    if (!user || !name.trim() || !title.trim() || !rate) {
      toast.error("Заполните название, заголовок и ставку");
      return;
    }
    const { error } = await supabase.from("job_templates").insert({
      dispatcher_id: user.id,
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      hourly_rate: parseInt(rate) || 0,
      duration_hours: parseFloat(duration) || 1,
      workers_needed: parseInt(workers) || 1,
      metro: metro.trim(),
      address: address.trim(),
    });
    if (error) {
      toast.error("Не удалось сохранить");
      return;
    }
    toast.success("Шаблон сохранён ✓");
    setName(""); setTitle(""); setDescription(""); setRate(""); setDuration("4"); setWorkers("1"); setMetro(""); setAddress("");
    setCreating(false);
    fetchTemplates();
  };

  const handlePost = async (t: JobTemplate) => {
    if (!user) return;
    setPosting(t.id);
    const { error } = await supabase.from("jobs").insert({
      dispatcher_id: user.id,
      title: t.title,
      description: t.description || "",
      hourly_rate: t.hourly_rate,
      duration_hours: t.duration_hours || 1,
      workers_needed: t.workers_needed || 1,
      metro: t.metro || "",
      address: t.address || "",
      urgent: t.urgent || false,
      quick_minimum: t.quick_minimum || false,
      template_id: t.id,
      status: "active",
    } as any);
    if (error) {
      toast.error("Не удалось опубликовать");
    } else {
      await supabase.from("job_templates").update({ use_count: t.use_count + 1 }).eq("id", t.id);
      toast.success("✅ Заявка опубликована");
      fetchTemplates();
    }
    setPosting(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить шаблон?")) return;
    await supabase.from("job_templates").delete().eq("id", id);
    setTemplates((p) => p.filter((t) => t.id !== id));
  };

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
                <h3 className="text-lg font-bold text-foreground">📋 Шаблоны заявок</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Публикуйте частые заявки в один клик</p>
            </div>

            <div className="p-5 space-y-3">
              {!creating && (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Plus size={16} /> Новый шаблон
                </button>
              )}

              {creating && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-1 border border-border rounded-2xl p-4 space-y-2.5">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название шаблона (для себя)" className="w-full bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок заявки" className="w-full bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" className="w-full bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none resize-none h-16" />
                  <div className="grid grid-cols-3 gap-2">
                    <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" placeholder="₽/ч" className="bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                    <input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" placeholder="часов" className="bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                    <input value={workers} onChange={(e) => setWorkers(e.target.value)} type="number" placeholder="чел." className="bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                  </div>
                  <input value={metro} onChange={(e) => setMetro(e.target.value)} placeholder="Метро" className="w-full bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Адрес" className="w-full bg-card rounded-lg p-2.5 text-sm text-foreground border border-border outline-none" />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setCreating(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-foreground text-sm font-semibold">Отмена</button>
                    <button onClick={handleCreate} className="flex-1 py-2.5 rounded-lg bg-foreground text-primary-foreground text-sm font-bold">Сохранить</button>
                  </div>
                </motion.div>
              )}

              {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  Нет шаблонов
                </div>
              ) : (
                templates.map((t) => (
                  <div key={t.id} className="bg-surface-1 border border-border rounded-2xl p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="text-green-500 font-semibold">{t.hourly_rate} ₽/ч</span>
                          <span>·</span>
                          <span>{t.workers_needed} чел.</span>
                          {t.metro && <><span>·</span><span>{t.metro}</span></>}
                          {t.use_count > 0 && <><span>·</span><span className="text-primary">⚡ {t.use_count}</span></>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(t.id)} className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                        <Trash2 size={13} className="text-destructive" />
                      </button>
                    </div>
                    <button
                      onClick={() => handlePost(t)}
                      disabled={posting === t.id}
                      className="w-full mt-2.5 py-2 rounded-xl bg-foreground text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      {posting === t.id ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                      {posting === t.id ? "Публикую..." : "Опубликовать"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default JobTemplatesModal;
