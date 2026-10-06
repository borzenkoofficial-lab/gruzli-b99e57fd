import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Loader2, Download, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ContractSignaturePad from "@/components/ContractSignaturePad";

interface ContractScreenProps {
  contractId: string;
  onBack: () => void;
}

const dataURLtoBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

const ContractScreen = ({ contractId, onBack }: ContractScreenProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [dispatcher, setDispatcher] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [existingSignature, setExistingSignature] = useState<any>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from("job_contracts")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();
      if (cancelled) return;
      if (!c) {
        toast.error("Договор не найден");
        onBack();
        return;
      }
      setContract(c);
      const [{ data: j }, { data: d }, { data: existing }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", c.job_id).maybeSingle(),
        supabase.rpc("get_job_party_profiles", {
          _job_id: c.job_id,
          _target_user_ids: [c.dispatcher_id],
        }).then(({ data, error }) => ({
          data: data?.[0] ?? null,
          error,
        })),
        supabase
          .from("contract_signatures")
          .select("*")
          .eq("contract_id", contractId)
          .eq("worker_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setJob(j);
      setDispatcher(d);
      if (existing?.signed_pdf_url) {
        setExistingSignature(existing);
        const { data: signed } = await supabase.storage
          .from("contracts")
          .createSignedUrl(existing.signed_pdf_url, 60 * 60);
        setSignedUrl(signed?.signedUrl || null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId, user, onBack]);

  const handleSign = async () => {
    if (!user || !signature) {
      toast.error("Поставьте подпись");
      return;
    }
    if (!agreed) {
      toast.error("Подтвердите согласие с условиями");
      return;
    }
    setSigning(true);
    try {
      // Upload signature image
      const blob = dataURLtoBlob(signature);
      const path = `${contractId}/sig-${user.id}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("contracts")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;

      // Generate signed PDF via edge function
      const { data, error } = await supabase.functions.invoke("generate-contract-pdf", {
        body: { contract_id: contractId, signature_path: path },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Ошибка генерации");

      toast.success("Договор подписан");
      setSignedUrl(data.signed_url);
      setExistingSignature({ signed_pdf_url: data.pdf_path, signed_at: new Date().toISOString() });
    } catch (e: any) {
      toast.error(e?.message || "Не удалось подписать");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="gruzli-contract-screen fixed inset-0 bg-background flex items-center justify-center" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="gruzli-contract-screen fixed inset-0 bg-background flex flex-col" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>
      <div className="flex items-center gap-3 px-4 safe-top pb-3 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText size={18} /> Договор
          </h1>
          <p className="text-[11px] text-muted-foreground -mt-0.5">№ {contractId.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] overscroll-contain touch-pan-y">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="text-base font-bold text-foreground">{contract.title}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">от {new Date(contract.created_at).toLocaleDateString("ru-RU")}</p>
          </div>

          <div className="space-y-1 text-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Стороны</div>
            <div><span className="text-muted-foreground">Заказчик: </span><span className="text-foreground">{dispatcher?.full_name || "—"}</span></div>
            <div><span className="text-muted-foreground">Исполнитель: </span><span className="text-foreground">Вы</span></div>
          </div>

          {job && (
            <div className="space-y-1 text-sm">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Предмет</div>
              <div className="text-foreground">{job.title}</div>
              {job.address && <div className="text-muted-foreground text-xs">📍 {job.address}</div>}
              {job.start_time && (
                <div className="text-muted-foreground text-xs">
                  🕒 {new Date(job.start_time).toLocaleString("ru-RU")}
                </div>
              )}
              {job.hourly_rate && (
                <div className="text-muted-foreground text-xs">
                  💰 {job.hourly_rate} ₽/час × {job.duration_hours || 1}ч
                </div>
              )}
            </div>
          )}

          {contract.body && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Условия</div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{contract.body}</p>
            </div>
          )}
        </motion.div>

        {existingSignature ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <CheckCircle2 size={20} className="text-[hsl(var(--online))]" />
              <span className="font-semibold">Договор подписан</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Подписано {new Date(existingSignature.signed_at).toLocaleString("ru-RU")}
            </p>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-semibold"
              >
                <Download size={16} /> Скачать PDF
              </a>
            )}
          </motion.div>
        ) : (
          <>
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground/80">Ваша подпись</span>
              </div>
              <ContractSignaturePad onChange={setSignature} />
            </div>

            <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-foreground"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Я ознакомлен(а) с условиями и подтверждаю, что подпись принадлежит мне
              </span>
            </label>
          </>
        )}
      </div>

      {!existingSignature && (
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-background via-background to-transparent">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSign}
            disabled={signing || !signature || !agreed}
            className="w-full py-4 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg"
          >
            {signing ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={16} /> Подписать договор</>}
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default ContractScreen;
