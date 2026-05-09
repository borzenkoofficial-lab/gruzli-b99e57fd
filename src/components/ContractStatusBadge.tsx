import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  jobId: string;
}

/**
 * Small banner shown on a worker's accepted order card.
 * - If the job requires a contract and worker hasn't signed it → CTA to sign.
 * - If signed → shows compact "signed" indicator.
 * Opens the contract via a global "open-contract" event, handled in Index.tsx.
 */
const ContractStatusBadge = ({ jobId }: Props) => {
  const { user } = useAuth();
  const [contractId, setContractId] = useState<string | null>(null);
  const [signed, setSigned] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const { data: c } = await supabase
        .from("job_contracts")
        .select("id")
        .eq("job_id", jobId)
        .maybeSingle();
      if (cancelled) return;
      if (!c) {
        setLoading(false);
        return;
      }
      setContractId(c.id);
      const { data: sig } = await supabase
        .from("contract_signatures")
        .select("id")
        .eq("contract_id", c.id)
        .eq("worker_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setSigned(!!sig);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, user]);

  if (loading || !contractId) return null;

  const open = () => {
    window.dispatchEvent(new CustomEvent("open-contract", { detail: { contractId } }));
  };

  if (signed) {
    return (
      <button
        onClick={open}
        className="w-full mb-3 flex items-center justify-between gap-2 rounded-xl bg-card border border-border px-3 py-2.5 active:scale-[0.99] transition-all"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <CheckCircle2 size={14} className="text-[hsl(var(--online))]" />
          Договор подписан
        </span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <FileText size={11} /> Открыть
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={open}
      className="w-full mb-3 flex items-center justify-between gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 active:scale-[0.99] transition-all"
    >
      <span className="flex items-center gap-2 text-xs font-bold text-primary">
        <ShieldCheck size={14} />
        Подпишите договор
      </span>
      <span className="text-[11px] text-primary/80">Подписать →</span>
    </button>
  );
};

export default ContractStatusBadge;
