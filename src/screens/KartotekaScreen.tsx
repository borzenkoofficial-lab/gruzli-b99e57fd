import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, User, Phone, Link2, Calendar, FileText, Camera, X,
  Edit3, Trash2, ArrowLeft, Save, AlertTriangle, UserX, ThumbsDown,
  HelpCircle, Filter, SlidersHorizontal, Shield, Eye, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface KartotekaEntry {
  id: string;
  author_id: string;
  target_user_id: string | null;
  full_name: string;
  birth_year: number | null;
  description: string | null;
  phone: string | null;
  social_links: string[] | null;
  photo_url: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: "мошенник", label: "Мошенник", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  { id: "не вышел", label: "Не вышел", icon: UserX, color: "text-orange-500", bg: "bg-orange-500/10" },
  { id: "плохая работа", label: "Плохая работа", icon: ThumbsDown, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { id: "другое", label: "Другое", icon: HelpCircle, color: "text-muted-foreground", bg: "bg-muted/50" },
];

const getCategoryMeta = (cat: string) =>
  CATEGORIES.find((c) => c.id === cat) || CATEGORIES[3];

const KartotekaScreen = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<KartotekaEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<KartotekaEntry | null>(null);
  const [viewEntry, setViewEntry] = useState<KartotekaEntry | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from("kartoteka")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEntries(data as KartotekaEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("kartoteka").delete().eq("id", id);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Запись удалена");
      setViewEntry(null);
    }
  };

  const filtered = entries.filter((e) => {
    const matchesSearch =
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone && e.phone.includes(search)) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = !activeFilter || e.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: entries.length,
    scammers: entries.filter((e) => e.category === "мошенник").length,
    noShows: entries.filter((e) => e.category === "не вышел").length,
    badWork: entries.filter((e) => e.category === "плохая работа").length,
  };

  if (showForm || editEntry) {
    return (
      <KartotekaForm
        entry={editEntry}
        onBack={() => { setShowForm(false); setEditEntry(null); }}
        onSaved={() => { setShowForm(false); setEditEntry(null); fetchEntries(); }}
      />
    );
  }

  if (viewEntry) {
    return (
      <EntryDetail
        entry={viewEntry}
        isOwner={viewEntry.author_id === user?.id}
        onBack={() => setViewEntry(null)}
        onEdit={() => { setEditEntry(viewEntry); setViewEntry(null); }}
        onDelete={() => handleDelete(viewEntry.id)}
      />
    );
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="px-5 safe-top pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <Shield size={22} className="text-primary" />
              Картотека
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Реестр недобросовестных исполнителей</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          >
            <Plus size={18} className="text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-5 py-3">
        <div className="flex gap-2">
          {[
            { label: "Всего", value: stats.total, color: "text-foreground" },
            { label: "Мошенники", value: stats.scammers, color: "text-red-500" },
            { label: "Не вышли", value: stats.noShows, color: "text-orange-500" },
            { label: "Плохая работа", value: stats.badWork, color: "text-yellow-500" },
          ].map((s) => (
            <div key={s.label} className="flex-1 neu-card rounded-2xl p-2.5 text-center">
              <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground font-medium leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="px-5 pb-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по ФИО, телефону..."
              className="w-full neu-inset rounded-2xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              activeFilter ? "gradient-primary" : "neu-raised"
            } active:neu-inset`}
          >
            <SlidersHorizontal size={16} className={activeFilter ? "text-primary-foreground" : "text-muted-foreground"} />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-3 flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveFilter(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  !activeFilter ? "gradient-primary text-primary-foreground" : "neu-raised-sm text-muted-foreground"
                }`}
              >
                Все
              </button>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveFilter(activeFilter === cat.id ? null : cat.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeFilter === cat.id
                        ? "gradient-primary text-primary-foreground"
                        : "neu-raised-sm text-muted-foreground"
                    }`}
                  >
                    <Icon size={12} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries list */}
      {loading ? (
        <div className="px-5 space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="neu-card rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Search size={28} className="text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">
            {entries.length === 0 ? "Картотека пуста" : "Ничего не найдено"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {entries.length === 0
              ? "Нажмите + чтобы добавить первую запись о недобросовестном исполнителе"
              : "Попробуйте изменить запрос или фильтры"}
          </p>
        </div>
      ) : (
        <div className="px-5 space-y-2.5 pt-1">
          {filtered.map((entry, i) => {
            const cat = getCategoryMeta(entry.category);
            const CatIcon = cat.icon;
            return (
              <motion.button
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setViewEntry(entry)}
                className="w-full neu-card rounded-2xl p-3.5 text-left active:neu-inset transition-all"
              >
                <div className="flex items-start gap-3">
                  {entry.photo_url ? (
                    <img
                      src={entry.photo_url}
                      alt={entry.full_name}
                      className="w-13 h-13 rounded-xl object-cover neu-raised flex-shrink-0"
                      style={{ width: 52, height: 52 }}
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-xl neu-raised flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52 }}>
                      <User size={20} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground truncate">{entry.full_name}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${cat.bg} ${cat.color}`}>
                        <CatIcon size={10} />
                        {cat.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ru })}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={14} className="text-muted-foreground rotate-[-90deg] flex-shrink-0 mt-1" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── Entry Detail View ─── */

interface EntryDetailProps {
  entry: KartotekaEntry;
  isOwner: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const EntryDetail = ({ entry, isOwner, onBack, onEdit, onDelete }: EntryDetailProps) => {
  const cat = getCategoryMeta(entry.category);
  const CatIcon = cat.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">Карточка</h1>
        {isOwner && (
          <div className="flex gap-2">
            <button onClick={onEdit} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
              <Edit3 size={16} className="text-primary" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all"
            >
              <Trash2 size={16} className="text-destructive" />
            </button>
          </div>
        )}
      </div>

      {/* Photo + Name */}
      <div className="px-5">
        <div className="neu-card rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-4">
            {entry.photo_url ? (
              <img src={entry.photo_url} alt={entry.full_name} className="w-20 h-20 rounded-2xl object-cover neu-raised" />
            ) : (
              <div className="w-20 h-20 rounded-2xl neu-raised flex items-center justify-center">
                <User size={32} className="text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-foreground">{entry.full_name}</h2>
              {entry.birth_year && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Calendar size={12} /> {entry.birth_year} г.р.
                </p>
              )}
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${cat.bg} ${cat.color}`}>
                  <CatIcon size={13} />
                  {cat.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact info */}
        {entry.phone && (
          <div className="neu-card rounded-2xl p-4 mb-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Контакты</p>
            <a href={`tel:${entry.phone}`} className="flex items-center gap-2.5 text-sm text-primary font-semibold">
              <Phone size={16} className="text-primary" />
              {entry.phone}
            </a>
          </div>
        )}

        {/* Description */}
        {entry.description && (
          <div className="neu-card rounded-2xl p-4 mb-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Описание проблемы</p>
            <p className="text-sm text-foreground leading-relaxed">{entry.description}</p>
          </div>
        )}

        {/* Social links */}
        {entry.social_links && entry.social_links.length > 0 && (
          <div className="neu-card rounded-2xl p-4 mb-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Ссылки</p>
            <div className="space-y-2">
              {entry.social_links.map((link, li) => {
                let hostname = link;
                try { hostname = new URL(link).hostname.replace("www.", ""); } catch {}
                return (
                  <a
                    key={li}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl neu-raised-sm text-xs text-primary font-medium active:neu-inset transition-all"
                  >
                    <Link2 size={13} />
                    {hostname}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="neu-card rounded-2xl p-4 mb-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Информация</p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>Добавлено: {new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p>Обновлено: {formatDistanceToNow(new Date(entry.updated_at), { addSuffix: true, locale: ru })}</p>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setConfirmDelete(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative neu-card rounded-3xl p-6 max-w-sm w-full text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 size={24} className="text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Удалить запись?</h3>
              <p className="text-sm text-muted-foreground">Это действие нельзя отменить</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-2xl neu-raised text-sm font-semibold text-muted-foreground">
                  Отмена
                </button>
                <button onClick={onDelete} className="flex-1 py-2.5 rounded-2xl bg-destructive text-destructive-foreground text-sm font-bold active:scale-95 transition-transform">
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Form ─── */

interface KartotekaFormProps {
  entry: KartotekaEntry | null;
  onBack: () => void;
  onSaved: () => void;
}

const KartotekaForm = ({ entry, onBack, onSaved }: KartotekaFormProps) => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(entry?.full_name || "");
  const [birthYear, setBirthYear] = useState(entry?.birth_year?.toString() || "");
  const [description, setDescription] = useState(entry?.description || "");
  const [phone, setPhone] = useState(entry?.phone || "");
  const [category, setCategory] = useState(entry?.category || "другое");
  const [socialLinks, setSocialLinks] = useState<string[]>(entry?.social_links || []);
  const [newLink, setNewLink] = useState("");
  const [photoUrl, setPhotoUrl] = useState(entry?.photo_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kartoteka-photos").upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from("kartoteka-photos").getPublicUrl(path);
      setPhotoUrl(urlData.publicUrl);
      toast.success("Фото загружено");
    } else {
      toast.error("Ошибка загрузки фото");
    }
    setUploading(false);
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    let url = newLink.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    setSocialLinks((prev) => [...prev, url]);
    setNewLink("");
  };

  const handleSave = async () => {
    if (!fullName.trim() || !user) return;
    setSaving(true);

    const payload = {
      author_id: user.id,
      full_name: fullName.trim(),
      birth_year: birthYear ? parseInt(birthYear) : null,
      description: description.trim() || null,
      phone: phone.trim() || null,
      social_links: socialLinks,
      photo_url: photoUrl || null,
      category,
    };

    if (entry) {
      const { error } = await supabase.from("kartoteka").update(payload).eq("id", entry.id);
      if (error) { toast.error("Ошибка обновления"); setSaving(false); return; }
      toast.success("Запись обновлена");
    } else {
      const { error } = await supabase.from("kartoteka").insert(payload);
      if (error) { toast.error("Ошибка создания"); setSaving(false); return; }
      toast.success("Запись добавлена в картотеку");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">
          {entry ? "Редактировать" : "Новая запись"}
        </h1>
        <button
          onClick={handleSave}
          disabled={!fullName.trim() || saving}
          className="px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={14} />
              Сохранить
            </>
          )}
        </button>
      </div>

      <div className="px-5 space-y-5">
        {/* Photo */}
        <div className="flex justify-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-28 h-28 rounded-2xl neu-raised flex items-center justify-center overflow-hidden active:neu-inset transition-all group"
          >
            {photoUrl ? (
              <>
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} className="text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Camera size={28} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Добавить фото</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* Category selector */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2.5 block">Категория *</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 p-3 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? "gradient-primary text-primary-foreground shadow-lg"
                      : "neu-raised text-muted-foreground active:neu-inset"
                  }`}
                >
                  <Icon size={16} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <FormField label="ФИО *" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        <FormField label="Год рождения" value={birthYear} onChange={setBirthYear} placeholder="1990" type="number" />
        <FormField label="Телефон" value={phone} onChange={setPhone} placeholder="+7 999 123-45-67" type="tel" />

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Описание ситуации *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите что произошло: не вышел на смену, украл инструмент, выполнил работу некачественно..."
            rows={4}
            className="w-full neu-inset rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Social links */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Ссылки на соц. сети</label>
          {socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="flex-1 neu-inset rounded-xl px-3 py-2.5 text-xs text-primary truncate">{link}</div>
              <button
                onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))}
                className="w-9 h-9 rounded-xl neu-raised-sm flex items-center justify-center active:neu-inset transition-all"
              >
                <X size={13} className="text-destructive" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
              placeholder="vk.com/username"
              className="flex-1 neu-inset rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              onClick={addLink}
              className="w-10 h-10 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all"
            >
              <Plus size={16} className="text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FormField = ({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-2 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full neu-inset rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
    />
  </div>
);

export default KartotekaScreen;
