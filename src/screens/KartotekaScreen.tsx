import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, User, Phone, Link2, Calendar, FileText, Camera, X, Edit3, Trash2, ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  created_at: string;
  updated_at: string;
}

const KartotekaScreen = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<KartotekaEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<KartotekaEntry | null>(null);

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
    }
  };

  const filtered = entries.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.phone && e.phone.includes(search)) ||
    (e.description && e.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (showForm || editEntry) {
    return (
      <KartotekaForm
        entry={editEntry}
        onBack={() => { setShowForm(false); setEditEntry(null); }}
        onSaved={() => { setShowForm(false); setEditEntry(null); fetchEntries(); }}
      />
    );
  }

  return (
    <div className="pb-28">
      <div className="px-5 pt-14 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Картотека</h1>
            <p className="text-sm text-muted-foreground mt-1">{entries.length} записей</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center active:scale-95 transition-transform"
            style={{
              boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
            }}
          >
            <Plus size={20} className="text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, телефону, описанию..."
            className="w-full neu-inset rounded-2xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {entries.length === 0 ? "Нет записей. Нажмите + чтобы добавить." : "Ничего не найдено"}
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {filtered.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="neu-card rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                {entry.photo_url ? (
                  <img
                    src={entry.photo_url}
                    alt={entry.full_name}
                    className="w-14 h-14 rounded-xl object-cover neu-raised"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl neu-raised flex items-center justify-center flex-shrink-0">
                    <User size={22} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">{entry.full_name}</h3>
                  {entry.birth_year && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar size={11} /> {entry.birth_year} г.р.
                    </p>
                  )}
                  {entry.phone && (
                    <p className="text-xs text-primary flex items-center gap-1 mt-1">
                      <Phone size={11} /> {entry.phone}
                    </p>
                  )}
                </div>
                {entry.author_id === user?.id && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setEditEntry(entry)}
                      className="w-9 h-9 rounded-xl neu-raised-sm flex items-center justify-center active:neu-inset transition-all"
                    >
                      <Edit3 size={14} className="text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="w-9 h-9 rounded-xl neu-raised-sm flex items-center justify-center active:neu-inset transition-all"
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                )}
              </div>

              {entry.description && (
                <div className="mt-3 neu-inset rounded-xl px-3 py-2">
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <FileText size={12} className="mt-0.5 flex-shrink-0 text-primary" />
                    {entry.description}
                  </p>
                </div>
              )}

              {entry.social_links && entry.social_links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.social_links.map((link, li) => (
                    <a
                      key={li}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg neu-raised-sm text-[11px] text-primary font-medium active:neu-inset transition-all"
                    >
                      <Link2 size={10} /> {new URL(link).hostname.replace("www.", "")}
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
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
    };

    if (entry) {
      const { error } = await supabase.from("kartoteka").update(payload).eq("id", entry.id);
      if (error) { toast.error("Ошибка обновления"); setSaving(false); return; }
      toast.success("Запись обновлена");
    } else {
      const { error } = await supabase.from("kartoteka").insert(payload);
      if (error) { toast.error("Ошибка создания"); setSaving(false); return; }
      toast.success("Запись добавлена");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">
          {entry ? "Редактировать" : "Новая запись"}
        </h1>
        <button
          onClick={handleSave}
          disabled={!fullName.trim() || saving}
          className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50"
        >
          <Save size={16} />
        </button>
      </div>

      <div className="px-5 space-y-4">
        {/* Photo */}
        <div className="flex justify-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-2xl neu-raised flex items-center justify-center overflow-hidden active:neu-inset transition-all"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={28} className="text-muted-foreground" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        <FormField label="ФИО *" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        <FormField label="Год рождения" value={birthYear} onChange={setBirthYear} placeholder="1990" type="number" />
        <FormField label="Телефон" value={phone} onChange={setPhone} placeholder="+7 999 123-45-67" type="tel" />

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Описание / Проблема</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите ситуацию..."
            rows={3}
            className="w-full neu-inset rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
          />
        </div>

        {/* Social links */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Ссылки на соц. сети</label>
          {socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="flex-1 neu-inset rounded-xl px-3 py-2 text-xs text-primary truncate">{link}</div>
              <button
                onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))}
                className="w-8 h-8 rounded-lg neu-raised-sm flex items-center justify-center"
              >
                <X size={12} className="text-destructive" />
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
