import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Shield, ShieldOff, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  rating: number | null;
  completed_orders: number | null;
  balance: number | null;
  verified: boolean | null;
  blocked: boolean | null;
  role: string | null;
  created_at: string;
}

const AdminUsersTab = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [balanceDialog, setBalanceDialog] = useState<AdminUser | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error("Ошибка загрузки пользователей");
      console.error(error);
    } else {
      setUsers((data as AdminUser[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleVerify = async (userId: string, verified: boolean) => {
    const { error } = await supabase.rpc("admin_set_verified", { _target_user_id: userId, _verified: verified });
    if (error) toast.error("Ошибка"); else { toast.success(verified ? "Верифицирован" : "Верификация снята"); fetchUsers(); }
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    const { error } = await supabase.rpc("admin_set_blocked", { _target_user_id: userId, _blocked: blocked });
    if (error) toast.error("Ошибка"); else { toast.success(blocked ? "Заблокирован" : "Разблокирован"); fetchUsers(); }
  };

  const handleBalance = async () => {
    if (!balanceDialog || !balanceAmount) return;
    const amount = parseInt(balanceAmount);
    if (isNaN(amount)) { toast.error("Введите число"); return; }
    const { error } = await supabase.rpc("admin_update_balance", { _target_user_id: balanceDialog.user_id, _amount: amount });
    if (error) toast.error("Ошибка"); else { toast.success(`Баланс обновлён на ${amount > 0 ? "+" : ""}${amount}`); setBalanceDialog(null); setBalanceAmount(""); fetchUsers(); }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по имени или телефону..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">Все роли</option>
          <option value="worker">Грузчики</option>
          <option value="dispatcher">Диспетчеры</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Баланс</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.user_id} className={u.blocked ? "opacity-50" : ""}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.phone || "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "dispatcher" ? "default" : "secondary"}>
                      {u.role === "dispatcher" ? "Диспетчер" : "Грузчик"}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.balance ?? 0} ₽</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.verified && <Badge variant="outline" className="text-green-600 border-green-600">✓ Верифицирован</Badge>}
                      {u.blocked && <Badge variant="destructive">Заблокирован</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => handleVerify(u.user_id, !u.verified)}>
                        {u.verified ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant={u.blocked ? "secondary" : "destructive"} onClick={() => handleBlock(u.user_id, !u.blocked)}>
                        {u.blocked ? <Shield className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setBalanceDialog(u)}>
                        <Wallet className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Нет пользователей</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!balanceDialog} onOpenChange={() => { setBalanceDialog(null); setBalanceAmount(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пополнить баланс — {balanceDialog?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Текущий баланс: {balanceDialog?.balance ?? 0} ₽</div>
            <Input type="number" placeholder="Сумма (может быть отрицательной)" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialog(null)}>Отмена</Button>
            <Button onClick={handleBalance}>Применить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersTab;
