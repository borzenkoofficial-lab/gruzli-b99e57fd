import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, Send, Loader2, Search, X, Users, Truck, Briefcase, ShieldCheck } from "lucide-react";

type RoleKey = "worker" | "dispatcher" | "admin";

interface UserRow {
  user_id: string;
  full_name: string;
  role: string | null;
}

interface RoleOpt {
  key: RoleKey;
  label: string;
  icon: any;
}

const ROLE_OPTS: RoleOpt[] = [
  { key: "worker", label: "Грузчики", icon: Truck },
  { key: "dispatcher", label: "Диспетчеры", icon: Briefcase },
  { key: "admin", label: "Админы", icon: ShieldCheck },
];

const AdminPushBroadcastsTab = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [roles, setRoles] = useState<Record<RoleKey, boolean>>({
    worker: false,
    dispatcher: false,
    admin: false,
  });
  const [counts, setCounts] = useState<Record<RoleKey, number>>({
    worker: 0,
    dispatcher: 0,
    admin: 0,
  });
  const [pushUsers, setPushUsers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [picked, setPicked] = useState<UserRow[]>([]);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadCounts = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    const c = { worker: 0, dispatcher: 0, admin: 0 } as Record<RoleKey, number>;
    for (const r of data || []) {
      if (r.role in c) c[r.role as RoleKey]++;
    }
    setCounts(c);

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("user_id");
    const set = new Set<string>();
    for (const s of subs || []) if (s.user_id) set.add(s.user_id);
    setPushUsers(set);
  };

  const loadUsers = async () => {
    const { data } = await supabase.rpc("admin_list_users");
    setUsers((data as any[])?.map((u) => ({
      user_id: u.user_id,
      full_name: u.full_name || "(без имени)",
      role: u.role,
    })) || []);
  };

  useEffect(() => {
    loadCounts();
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter(
        (u) =>
          !picked.find((p) => p.user_id === u.user_id) &&
          (u.full_name.toLowerCase().includes(q) || u.user_id.includes(q))
      )
      .slice(0, 8);
  }, [search, users, picked]);

  const togglePick = (u: UserRow) => {
    setPicked((prev) => [...prev, u]);
    setSearch("");
  };
  const removePick = (id: string) =>
    setPicked((prev) => prev.filter((p) => p.user_id !== id));

  const toggleRole = (k: RoleKey) =>
    setRoles((prev) => ({ ...prev, [k]: !prev[k] }));

  const audienceUserIds = useMemo(() => {
    const ids = new Set<string>(picked.map((p) => p.user_id));
    for (const u of users) {
      const r = u.role as RoleKey;
      if (r && roles[r]) ids.add(u.user_id);
    }
    return ids;
  }, [picked, users, roles]);

  const subscribedCount = useMemo(() => {
    let n = 0;
    audienceUserIds.forEach((id) => {
      if (pushUsers.has(id)) n++;
    });
    return n;
  }, [audienceUserIds, pushUsers]);

  const validate = () => {
    if (!title.trim()) return toast.error("Введите заголовок");
    if (!body.trim()) return toast.error("Введите текст");
    if (audienceUserIds.size === 0) return toast.error("Выберите аудиторию");
    if (url && !/^https?:\/\//i.test(url.trim()))
      return toast.error("Ссылка должна начинаться с http:// или https://");
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const selectedRoles = (Object.keys(roles) as RoleKey[]).filter((k) => roles[k]);
      const { data, error } = await supabase.functions.invoke("admin-push-broadcast", {
        body: {
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          roles: selectedRoles,
          user_ids: picked.map((p) => p.user_id),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        `Отправлено: ${data?.sent ?? 0} / ${data?.total ?? 0} устройств (${data?.recipients ?? 0} получателей)`
      );
      setTitle("");
      setBody("");
      setUrl("");
      setPicked([]);
      setRoles({ worker: false, dispatcher: false, admin: false });
    } catch (err: any) {
      toast.error(err.message || "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Push-рассылка</h2>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Заголовок</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Новое обновление!"
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Текст</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Что сообщить пользователям?"
            rows={4}
            maxLength={300}
            className="resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{body.length} / 300</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            Ссылка при клике (необязательно)
          </Label>
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://gruzli.lovable.app/..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Аудитория по ролям
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ROLE_OPTS.map((r) => {
              const Icon = r.icon;
              const active = roles[r.key];
              return (
                <label
                  key={r.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border bg-muted/30"
                  }`}
                >
                  <Checkbox checked={active} onCheckedChange={() => toggleRole(r.key)} />
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">{counts[r.key]} человек</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">
            Конкретные пользователи (необязательно)
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени…"
              className="pl-9"
            />
            {filtered.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                {filtered.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => togglePick(u)}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between"
                  >
                    <span className="text-sm truncate">{u.full_name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <Badge key={p.user_id} variant="secondary" className="gap-1">
                  {p.full_name}
                  <button onClick={() => removePick(p.user_id)} aria-label="Убрать">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex-1">
            Аудитория: <span className="font-bold text-foreground">{audienceUserIds.size}</span> чел.
            {" · "}С push-подпиской: <span className="font-bold text-foreground">{subscribedCount}</span>
          </p>
          <Button
            onClick={validate}
            disabled={sending || !title.trim() || !body.trim() || audienceUserIds.size === 0}
            className="w-full sm:w-auto"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Отправка…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Отправить push
              </>
            )}
          </Button>
        </div>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить push?</AlertDialogTitle>
            <AlertDialogDescription>
              Push-уведомление получат пользователи с активной подпиской —
              примерно <strong>{subscribedCount}</strong> устройств. Отменить будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>Отправить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPushBroadcastsTab;
