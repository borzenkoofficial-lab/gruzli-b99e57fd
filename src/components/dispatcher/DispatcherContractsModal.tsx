import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Download, Send, CheckCircle2, Loader2, Plus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DispatcherContractsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ContractRow {
  id: string;
  job_id: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  job?: { id: string; title: string; address: string | null } | null;
  workers: Array<{
    response_id: string;
    worker_id: string;
    worker_name: string;
    worker_phone: string | null;
    signed: boolean;
    signed_at: string | null;
    signed_pdf_url: string | null;
  }>;
}

const DispatcherContractsModal = ({ open, onClose }: DispatcherContractsModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [jobsWithoutContract, setJobsWithoutContract] = useState<Array<{ id: string; title: string }>>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: contractsData }, { data: jobsData }] = await Promise.all([
        supabase.from("job_contracts").select("*").eq("dispatcher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("jobs").select("id, title").eq("dispatcher_id", user.id).in("status", ["active", "filled", "in_progress"]),
      ]);

      const contractList = contractsData || [];
      const jobIds = contractList.map((c) => c.job_id);

      const [{ data: jobs }, { data: responses }, { data: signatures }] = await Promise.all([
        jobIds.length
          ? supabase.from("jobs").select("id, title, address").in("id", jobIds)
          : Promise.resolve({ data: [] as any[] }),
        jobIds.length
          ? supabase.from("job_responses").select("id, job_id, worker_id, status").in("job_id", jobIds).eq("status", "accepted")
          : Promise.resolve({ data: [] as any[] }),
        contractList.length
          ? supabase.from("contract_signatures").select("*").in("contract_id", contractList.map((c) => c.id))
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const workerIds = Array.from(new Set((responses || []).map((r: any) => r.worker_id)));
      const { data: profiles } = workerIds.length
        ? await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", workerIds)
        : { data: [] as any[] };

      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const sigMap = new Map<string, any>();
      (signatures || []).forEach((s: any) => sigMap.set(`${s.contract_id}:${s.worker_id}`, s));

      const rows: ContractRow[] = contractList.map((c: any) => {
        const job = (jobs || []).find((j: any) => j.id === c.job_id) || null;
        const accepted = (responses || []).filter((r: any) => r.job_id === c.job_id);
        return {
          id: c.id,
          job_id: c.job_id,
          title: c.title,
          body: c.body,
          status: c.status,
          created_at: c.created_at,
          job,
          workers: accepted.map((r: any) => {
            const p = profMap.get(r.worker_id) as any;
            const sig = sigMap.get(`${c.id}:${r.worker_id}`);
            return {
              response_id: r.id,
              worker_id: r.worker_id,
              worker_name: p?.full_name || "Грузчик",
              worker_phone: p?.phone || null,
              signed: !!sig?.signed_pdf_url,
              signed_at: sig?.signed_at || null,
              signed_pdf_url: sig?.signed_pdf_url || null,
            };
          }),
        };
      });

      setContracts(rows);

      const contractedJobIds = new Set(contractList.map((c: any) => c.job_id));
      setJobsWithoutContract((jobsData || []).filter((j: any) => !contractedJobIds.has(j.id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchAll();
  }, [open, user]);

  const downloadPdf = async (contractId: string, workerId?: string) => {
    setBusyId(`${contractId}:${workerId || "blank"}`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-preview", {
        body: { contract_id: contractId, worker_id: workerId || null },
      });
      if (error) throw error;
      if (data?.signed_url) {
        window.open(data.signed_url, "_blank");
        toast.success("PDF готов");
      } else {
        throw new Error("Нет ссылки");
      }
    } catch (e: any) {
      toast.error(e?.message || "Ошибка генерации PDF");
    } finally {
      setBusyId(null);
    }
  };

  const downloadSigned = async (path: string) => {
    const { data } = await supabase.storage.from("contracts").createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Файл не найден");
  };

  const sendToChat = async (workerId: string, workerName: string, contractTitle: string) => {
    setBusyId(`chat:${workerId}`);
    try {
      const { data: convId, error } = await supabase.rpc("create_direct_conversation", {
        _other_user_id: workerId,
        _title: "",
      });
      if (error) throw error;
      const text = `📄 Прошу подписать договор: «${contractTitle}». Откройте раздел «Заказы» — баннер договора над активной заявкой.`;
      await supabase.from("messages").insert({
        conversation_id: convId as string,
        sender_id: user!.id,
        text,
      });
      toast.success(`Отправлено ${workerName}`);
    } catch (e: any) {
      toast.error(e?.message || "Не удалось отправить");
    } finally {
      setBusyId(null);
    }
  };

  const createContractForJob = async (jobId: string, jobTitle: string) => {
    if (!user) return;
    setBusyId(`new:${jobId}`);
    try {
      const { error } = await supabase.from("job_contracts").insert({
        job_id: jobId,
        dispatcher_id: user.id,
        title: `Договор по заявке: ${jobTitle}`,
        body:
          "1. Исполнитель обязуется выполнить работы качественно и в срок.\n" +
          "2. Заказчик оплачивает работу согласно почасовой ставке.\n" +
          "3. Стороны несут ответственность за сохранность имущества.\n" +
          "4. Соблюдение техники безопасности обязательно.",
        status: "active",
      });
      if (error) throw error;
      await supabase.from("jobs").update({ requires_contract: true }).eq("id", jobId);
      toast.success("Договор создан");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              <h2 className="font-bold text-foreground">Договоры</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-1">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <>
                {contracts.length === 0 && jobsWithoutContract.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Нет активных заявок и договоров
                  </div>
                )}

                {contracts.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-surface-1 border border-border p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.job?.title || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => downloadPdf(c.id)}
                        disabled={busyId === `${c.id}:blank`}
                        className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary"
                      >
                        {busyId === `${c.id}:blank` ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Download size={12} />
                        )}
                        Шаблон
                      </button>
                    </div>

                    {c.workers.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic px-1 py-2">
                        Пока нет принятых исполнителей
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {c.workers.map((w) => (
                          <div
                            key={w.worker_id}
                            className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {w.worker_name}
                                </span>
                                {w.signed && (
                                  <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {w.signed
                                  ? `Подписан ${new Date(w.signed_at!).toLocaleDateString("ru-RU")}`
                                  : "Ожидает подписи"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {w.signed && w.signed_pdf_url ? (
                                <button
                                  onClick={() => downloadSigned(w.signed_pdf_url!)}
                                  className="p-1.5 rounded-lg bg-green-500/10 text-green-500"
                                  title="Скачать подписанный"
                                >
                                  <Download size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => downloadPdf(c.id, w.worker_id)}
                                  disabled={busyId === `${c.id}:${w.worker_id}`}
                                  className="p-1.5 rounded-lg bg-primary/10 text-primary"
                                  title="Скачать с ФИО"
                                >
                                  {busyId === `${c.id}:${w.worker_id}` ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Download size={13} />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => sendToChat(w.worker_id, w.worker_name, c.title)}
                                disabled={busyId === `chat:${w.worker_id}`}
                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"
                                title="Отправить ссылку в чат"
                              >
                                {busyId === `chat:${w.worker_id}` ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Send size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {jobsWithoutContract.length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-muted-foreground px-1 mb-2">
                      Заявки без договора
                    </div>
                    <div className="space-y-1.5">
                      {jobsWithoutContract.map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-1 border border-border"
                        >
                          <div className="flex-1 min-w-0 text-sm text-foreground truncate">
                            {j.title}
                          </div>
                          <button
                            onClick={() => createContractForJob(j.id, j.title)}
                            disabled={busyId === `new:${j.id}`}
                            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground"
                          >
                            {busyId === `new:${j.id}` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Plus size={12} />
                            )}
                            Создать
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DispatcherContractsModal;
