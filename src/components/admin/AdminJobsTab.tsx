import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Job {
  id: string;
  title: string;
  status: string | null;
  hourly_rate: number;
  address: string | null;
  workers_needed: number | null;
  created_at: string;
  dispatcher_name?: string;
  responses_count?: number;
}

const AdminJobsTab = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      const { data: jobsData } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (!jobsData) { setLoading(false); return; }

      const dispatcherIds = [...new Set(jobsData.map(j => j.dispatcher_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", dispatcherIds);
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const { data: responses } = await supabase.from("job_responses").select("job_id");
      const countMap = new Map<string, number>();
      responses?.forEach(r => countMap.set(r.job_id, (countMap.get(r.job_id) || 0) + 1));

      setJobs(jobsData.map(j => ({
        ...j,
        dispatcher_name: nameMap.get(j.dispatcher_id) || "—",
        responses_count: countMap.get(j.id) || 0,
      })));
      setLoading(false);
    };
    fetchJobs();
  }, []);

  const filtered = jobs.filter(j => statusFilter === "all" || j.status === statusFilter);

  const statusLabel = (s: string | null) => {
    if (s === "active") return { label: "Активный", variant: "default" as const };
    if (s === "completed") return { label: "Завершён", variant: "secondary" as const };
    if (s === "cancelled") return { label: "Отменён", variant: "destructive" as const };
    return { label: s || "—", variant: "outline" as const };
  };

  return (
    <div className="space-y-4">
      <select className="border rounded-md px-3 py-2 text-sm bg-background" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="all">Все статусы</option>
        <option value="active">Активные</option>
        <option value="completed">Завершённые</option>
        <option value="cancelled">Отменённые</option>
      </select>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Диспетчер</TableHead>
                <TableHead>Ставка</TableHead>
                <TableHead>Отклики</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(j => {
                const st = statusLabel(j.status);
                return (
                  <TableRow key={j.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{j.title}</div>
                        <div className="text-xs text-muted-foreground">{j.address || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{j.dispatcher_name}</TableCell>
                    <TableCell>{j.hourly_rate} ₽/ч</TableCell>
                    <TableCell>{j.responses_count}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(j.created_at), "dd.MM.yy")}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Нет заказов</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminJobsTab;
