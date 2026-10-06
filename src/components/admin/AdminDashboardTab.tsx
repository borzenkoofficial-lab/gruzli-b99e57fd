import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Star, TrendingUp, Loader2 } from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  onlineNow: number;
  newToday: number;
  newThisWeek: number;
  avgRating: number;
  totalRatings: number;
}

interface RatingEntry {
  id: string;
  rating: number;
  feedback: string | null;
  created_at: string;
  user_name: string;
}

const AdminDashboardTab = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ratings, setRatings] = useState<RatingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchRatings()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data, error } = await supabase.rpc("admin_dashboard_stats");
    if (error || !data) {
      console.error("admin_dashboard_stats failed", error);
      setStats({
        totalUsers: 0,
        onlineNow: 0,
        newToday: 0,
        newThisWeek: 0,
        avgRating: 0,
        totalRatings: 0,
      });
      return;
    }
    setStats({
      totalUsers: Number(data.totalUsers || 0),
      onlineNow: Number(data.onlineNow || 0),
      newToday: Number(data.newToday || 0),
      newThisWeek: Number(data.newThisWeek || 0),
      avgRating: Number(data.avgRating || 0),
      totalRatings: Number(data.totalRatings || 0),
    });
  };

  const fetchRatings = async () => {
    const { data } = await supabase
      .from("app_ratings")
      .select("id, rating, feedback, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data || data.length === 0) { setRatings([]); return; }

    const userIds = [...new Set(data.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles_public" as any)
      .select("user_id, full_name")
      .in("user_id", userIds);

    const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    setRatings(data.map(r => ({
      id: r.id,
      rating: r.rating,
      feedback: r.feedback,
      created_at: r.created_at,
      user_name: nameMap.get(r.user_id) || "—",
    })));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const s = stats!;

  return (
    <div className="space-y-4 mt-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="Всего" value={s.totalUsers} />
        <StatCard icon={<UserCheck className="h-4 w-4 text-green-500" />} label="Онлайн" value={s.onlineNow} accent />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Новых сегодня" value={s.newToday} />
        <StatCard icon={<Star className="h-4 w-4 text-yellow-400" />} label="Оценка" value={`${s.avgRating} (${s.totalRatings})`} />
      </div>

      {/* Ratings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" />
            Отзывы пользователей
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ratings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Оценок пока нет</p>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Оценка</TableHead>
                  <TableHead>Отзыв</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-xs">{r.user_name}</TableCell>
                    <TableCell>
                      <Badge variant={r.rating >= 4 ? "default" : r.rating >= 3 ? "secondary" : "destructive"}>
                        {"★".repeat(r.rating)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{r.feedback || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-accent">{icon}</div>
      <div>
        <p className={`text-xl font-bold ${accent ? "text-green-500" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

export default AdminDashboardTab;
