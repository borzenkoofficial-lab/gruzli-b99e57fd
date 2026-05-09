import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileText, Download, Send, CheckCircle2, Loader2, Plus, Receipt, FileCheck2, Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

type TabKey = "contracts" | "acts" | "receipts";

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
    signed: boolean;
    signed_at: string | null;
    signed_pdf_url: string | null;
  }>;
}

interface AcceptedWorkerJob {
  job_id: string;
  job_title: string;
  job_status: string;
  hourly_rate: number;
  worker_id: string;
  worker_name: string;
  hours_worked: number | null;
  earned: number | null;
  worker_status: string | null;
}

interface DocRow {
  id: string;
  type: "act" | "receipt" | "contract";
  number: string | null;
  title: string;
  amount: number;
  hours: number | null;
  pdf_path: string | null;
  created_at: string;
  worker_id: string | null;
  job_id: string;
  metadata: any;
}

const DispatcherDocumentsModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("contracts");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [jobsWithoutContract, setJobsWithoutContract] = useState<Array<{ id: string; title: string }>>([]);
  const [acceptedWorkers, setAcceptedWorkers] = useState<AcceptedWorkerJob[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);

  // Dispatcher INN settings
  const [inn, setInn] = useState("");
  const [isSelfEmployed, setIsSelfEmployed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        { data: contractsData },
        { data: jobsData },
        { data: docs },
        { data: prof },
      ] = await Promise.all([
        supabase.from("job_contracts").select("*").eq("dispatcher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("jobs").select("id, title, hourly_rate, status").eq("dispatcher_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("job_documents").select("*").eq("dispatcher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("inn, is_self_employed").eq("user_id", user.id).maybeSingle(),
      ]);

      setInn((prof as any)?.inn || "");
      setIsSelfEmployed(!!(prof as any)?.is_self_employed);
      setDocuments((docs || []) as any);

      // === Contracts ===
      const contractList = contractsData || [];
      const contractJobIds = contractList.map((c: any) => c.job_id);
      const [{ data: cJobs }, { data: cResponses }, { data: signatures }] = await Promise.all([
        contractJobIds.length
          ? supabase.from("jobs").select("id, title, address").in("id", contractJobIds)
          : Promise.resolve({ data: [] as any[] }),
        contractJobIds.length
          ? supabase.from("job_responses").select("id, job_id, worker_id, status").in("job_id", contractJobIds).eq("status", "accepted")
          : Promise.resolve({ data: [] as any[] }),
        contractList.length
          ? supabase.from("contract_signatures").select("*").in("contract_id", contractList.map((c: any) => c.id))
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const cWorkerIds = Array.from(new Set((cResponses || []).map((r: any) => r.worker_id)));

      // === All accepted workers (for Acts/Receipts) ===
      const allJobIds = (jobsData || []).map((j: any) => j.id);
      const { data: allResponses } = allJobIds.length
        ? await supabase.from("job_responses").select("*").in("job_id", allJobIds).eq("status", "accepted")
        : { data: [] as any[] };

      const allWorkerIds = Array.from(new Set([
        ...cWorkerIds,
        ...(allResponses || []).map((r: any) => r.worker_id),
      ]));

      const { data: profiles } = allWorkerIds.length
        ? await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", allWorkerIds)
        : { data: [] as any[] };
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const sigMap = new Map<string, any>();
      (signatures || []).forEach((s: any) => sigMap.set(`${s.contract_id}:${s.worker_id}`, s));

      const rows: ContractRow[] = contractList.map((c: any) => {
        const job = (cJobs || []).find((j: any) => j.id === c.job_id) || null;
        const accepted = (cResponses || []).filter((r: any) => r.job_id === c.job_id);
        return {
          id: c.id, job_id: c.job_id, title: c.title, body: c.body,
          status: c.status, created_at: c.created_at, job,
          workers: accepted.map((r: any) => {
            const p = profMap.get(r.worker_id) as any;
            const sig = sigMap.get(`${c.id}:${r.worker_id}`);
            return {
              response_id: r.id, worker_id: r.worker_id,
              worker_name: p?.full_name || "Грузчик",
              signed: !!sig?.signed_pdf_url,
              signed_at: sig?.signed_at || null,
              signed_pdf_url: sig?.signed_pdf_url || null,
            };
          }),
        };
      });
      setContracts(rows);

      const contractedJobIds = new Set(contractList.map((c: any) => c.job_id));
      setJobsWithoutContract((jobsData || []).filter((j: any) => !contractedJobIds.has(j.id) && j.status !== "deleted").map((j: any) => ({ id: j.id, title: j.title })));

      const accW: AcceptedWorkerJob[] = (allResponses || []).map((r: any) => {
        const j = (jobsData || []).find((x: any) => x.id === r.job_id);
        const p = profMap.get(r.worker_id) as any;
        return {
          job_id: r.job_id,
          job_title: j?.title || "—",
          job_status: j?.status || "",
          hourly_rate: j?.hourly_rate || 0,
          worker_id: r.worker_id,
          worker_name: p?.full_name || "Грузчик",
          hours_worked: r.hours_worked,
          earned: r.earned,
          worker_status: r.worker_status,
        };
      });
      setAcceptedWorkers(accW);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchAll();
  }, [open, user]);

  const downloadContractPdf = async (contractId: string, workerId?: string) => {
    setBusyId(`cpdf:${contractId}:${workerId || "blank"}`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-preview", {
        body: { contract_id: contractId, worker_id: workerId || null },
      });
      if (error) throw error;
      if (data?.signed_url) window.open(data.signed_url, "_blank");
      else throw new Error("Нет ссылки");
    } catch (e: any) { toast.error(e?.message || "Ошибка"); }
    finally { setBusyId(null); }
  };

  const downloadStored = async (bucket: "contracts" | "documents", path: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Файл не найден");
  };

  const sendToChat = async (workerId: string, workerName: string, text: string) => {
    setBusyId(`chat:${workerId}`);
    try {
      const { data: convId, error } = await supabase.rpc("create_direct_conversation", {
        _other_user_id: workerId, _title: "",
      });
      if (error) throw error;
      await supabase.from("messages").insert({
        conversation_id: convId as string, sender_id: user!.id, text,
      });
      toast.success(`Отправлено ${workerName}`);
    } catch (e: any) { toast.error(e?.message || "Не удалось отправить"); }
    finally { setBusyId(null); }
  };

  const generateDoc = async (type: "act" | "receipt", row: AcceptedWorkerJob) => {
    setBusyId(`gen:${type}:${row.job_id}:${row.worker_id}`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          type, job_id: row.job_id, worker_id: row.worker_id,
          amount: row.earned ?? (Number(row.hours_worked || 0) * row.hourly_rate),
          hours: row.hours_worked,
        },
      });
      if (error) throw error;
      if (data?.signed_url) {
        window.open(data.signed_url, "_blank");
        toast.success(type === "act" ? "Акт сформирован" : "Чек сформирован");
        fetchAll();
      } else throw new Error("Нет ссылки");
    } catch (e: any) { toast.error(e?.message || "Ошибка"); }
    finally { setBusyId(null); }
  };

  const createContractForJob = async (jobId: string, jobTitle: string) => {
    if (!user) return;
    setBusyId(`new:${jobId}`);
    try {
      const { error } = await supabase.from("job_contracts").insert({
        job_id: jobId, dispatcher_id: user.id,
        title: `Договор по заявке: ${jobTitle}`,
        body: "1. Исполнитель обязуется выполнить работы качественно и в срок.\n2. Заказчик оплачивает работу согласно почасовой ставке.\n3. Стороны несут ответственность за сохранность имущества.\n4. Соблюдение техники безопасности обязательно.",
        status: "active",
      });
      if (error) throw error;
      await supabase.from("jobs").update({ requires_contract: true }).eq("id", jobId);
      toast.success("Договор создан");
      fetchAll();
    } catch (e: any) { toast.error(e?.message || "Ошибка"); }
    finally { setBusyId(null); }
  };

  const saveSettings = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      inn: inn.trim() || null,
      is_self_employed: isSelfEmployed,
    }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Сохранено"); setShowSettings(false); }
  };

  if (!open) return null;

  const docsByType = (t: "act" | "receipt") => documents.filter((d) => d.type === t);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full mx-auto max-w-lg bg-background flex flex-col"
          style={{ height: "var(--vh, 100vh)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              <h2 className="font-bold text-foreground">Документы</h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSettings((v) => !v)} className="p-2 rounded-xl hover:bg-surface-1" title="Реквизиты">
                <Settings2 size={18} className="text-muted-foreground" />
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-1">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-4 pt-3 pb-2 border-b border-border bg-surface-1/40">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Реквизиты заказчика</div>
              <input
                value={inn}
                onChange={(e) => setInn(e.target.value)}
                placeholder="ИНН"
                inputMode="numeric"
                className="w-full mb-2 px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground"
              />
              <label className="flex items-center gap-2 text-sm text-foreground mb-2">
                <input type="checkbox" checked={isSelfEmployed} onChange={(e) => setIsSelfEmployed(e.target.checked)} />
                Я самозанятый (НПД)
              </label>
              <button onClick={saveSettings} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                Сохранить
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <div className="flex gap-1 bg-card border border-border rounded-2xl p-1">
              {[
                { id: "contracts" as const, label: "Договоры", icon: FileText },
                { id: "acts" as const, label: "Акты", icon: FileCheck2 },
                { id: "receipts" as const, label: "Чеки", icon: Receipt },
              ].map((t) => {
                const Ic = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <Ic size={13} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
          >
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
              <>
                {tab === "contracts" && (
                  <>
                    {contracts.length === 0 && jobsWithoutContract.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">Нет договоров и активных заявок</div>
                    )}
                    {contracts.map((c) => (
                      <div key={c.id} className="rounded-2xl bg-surface-1 border border-border p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-sm truncate">{c.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.job?.title || "—"}</div>
                          </div>
                          <button
                            onClick={() => downloadContractPdf(c.id)}
                            disabled={busyId === `cpdf:${c.id}:blank`}
                            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary"
                          >
                            {busyId === `cpdf:${c.id}:blank` ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            Шаблон
                          </button>
                        </div>
                        {c.workers.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic px-1 py-2">Пока нет принятых исполнителей</div>
                        ) : (
                          <div className="space-y-1.5">
                            {c.workers.map((w) => (
                              <div key={w.worker_id} className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-foreground truncate">{w.worker_name}</span>
                                    {w.signed && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {w.signed ? `Подписан ${new Date(w.signed_at!).toLocaleDateString("ru-RU")}` : "Ожидает подписи"}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {w.signed && w.signed_pdf_url ? (
                                    <button onClick={() => downloadStored("contracts", w.signed_pdf_url!)} className="p-1.5 rounded-lg bg-green-500/10 text-green-500" title="Скачать подписанный">
                                      <Download size={13} />
                                    </button>
                                  ) : (
                                    <button onClick={() => downloadContractPdf(c.id, w.worker_id)} disabled={busyId === `cpdf:${c.id}:${w.worker_id}`} className="p-1.5 rounded-lg bg-primary/10 text-primary" title="Скачать с ФИО">
                                      {busyId === `cpdf:${c.id}:${w.worker_id}` ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                    </button>
                                  )}
                                  <button onClick={() => sendToChat(w.worker_id, w.worker_name, `📄 Прошу подписать договор: «${c.title}». Откройте раздел «Заказы».`)} disabled={busyId === `chat:${w.worker_id}`} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500" title="Отправить в чат">
                                    {busyId === `chat:${w.worker_id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
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
                        <div className="text-xs font-semibold text-muted-foreground px-1 mb-2">Заявки без договора</div>
                        <div className="space-y-1.5">
                          {jobsWithoutContract.map((j) => (
                            <div key={j.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-1 border border-border">
                              <div className="flex-1 min-w-0 text-sm text-foreground truncate">{j.title}</div>
                              <button onClick={() => createContractForJob(j.id, j.title)} disabled={busyId === `new:${j.id}`} className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground">
                                {busyId === `new:${j.id}` ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Создать
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {(tab === "acts" || tab === "receipts") && (
                  <>
                    <div className="text-xs font-semibold text-muted-foreground px-1 mb-1">
                      {tab === "acts" ? "Сформировать акт по исполнителю" : "Сформировать чек по исполнителю"}
                    </div>
                    {acceptedWorkers.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">Нет принятых исполнителей</div>
                    ) : (
                      <div className="space-y-1.5">
                        {acceptedWorkers.map((w) => {
                          const amount = w.earned ?? Math.round(Number(w.hours_worked || 0) * w.hourly_rate);
                          const id = `${w.job_id}:${w.worker_id}`;
                          const busy = busyId === `gen:${tab === "acts" ? "act" : "receipt"}:${w.job_id}:${w.worker_id}`;
                          return (
                            <div key={id} className="p-2.5 rounded-xl bg-surface-1 border border-border">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground truncate">{w.worker_name}</div>
                                  <div className="text-[11px] text-muted-foreground truncate">{w.job_title}</div>
                                </div>
                                <button
                                  onClick={() => generateDoc(tab === "acts" ? "act" : "receipt", w)}
                                  disabled={busy}
                                  className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground"
                                >
                                  {busy ? <Loader2 size={12} className="animate-spin" /> : (tab === "acts" ? <FileCheck2 size={12} /> : <Receipt size={12} />)}
                                  {tab === "acts" ? "Акт" : "Чек"}
                                </button>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {w.hours_worked ? `${w.hours_worked} ч × ${w.hourly_rate} ₽ = ` : ""}
                                <span className="text-foreground font-semibold">{amount} ₽</span>
                                {w.worker_status === "completed" && <span className="text-green-500 ml-1">• завершено</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-3">
                      <div className="text-xs font-semibold text-muted-foreground px-1 mb-2">История</div>
                      {docsByType(tab === "acts" ? "act" : "receipt").length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-xs">Пока нет документов</div>
                      ) : (
                        <div className="space-y-1.5">
                          {docsByType(tab === "acts" ? "act" : "receipt").map((d) => (
                            <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-card border border-border">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-foreground truncate">{d.number || d.title}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(d.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  {" • "}{d.amount} ₽ • {d.metadata?.worker_name || ""}
                                </div>
                              </div>
                              {d.pdf_path && (
                                <button onClick={() => downloadStored("documents", d.pdf_path!)} className="p-1.5 rounded-lg bg-primary/10 text-primary" title="Скачать">
                                  <Download size={13} />
                                </button>
                              )}
                              {d.worker_id && (
                                <button
                                  onClick={() => sendToChat(d.worker_id!, d.metadata?.worker_name || "Исполнитель", `📎 Сформирован документ: ${d.number || d.title}`)}
                                  disabled={busyId === `chat:${d.worker_id}`}
                                  className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"
                                  title="Отправить в чат"
                                >
                                  {busyId === `chat:${d.worker_id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DispatcherDocumentsModal;
