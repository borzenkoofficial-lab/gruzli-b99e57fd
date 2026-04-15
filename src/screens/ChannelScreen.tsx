import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Send, Loader2, Trash2, Share, MoreHorizontal, BadgeCheck, Users, Image as ImageIcon, Pin, Settings, Bell, ChevronRight, Eye, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import updateChatImg from "@/assets/update-chat.jpg";
import updateEmailImg from "@/assets/update-email.jpg";
import updateChannelImg from "@/assets/update-channel.jpg";

interface ChannelScreenProps {
  onBack: () => void;
}

interface Post {
  id: string;
  author_id: string;
  text: string;
  image_url: string | null;
  created_at: string;
  authorName: string;
  likesCount: number;
  commentsCount: number;
  liked: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  userName: string;
}

/** Stable pseudo-random 1000–2000 from post id */
function fakeViews(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 1000 + Math.abs(h) % 1001;
}

const placeholderPosts: Omit<Post, "liked">[] = [
  {
    id: "placeholder-1",
    author_id: "",
    text: "🚀 Запустили официальный канал Gruzli!\n\nТеперь все обновления, новости и важные объявления будут публиковаться здесь. Подписывайтесь и следите за новостями!\n\n#gruzli #обновление",
    image_url: updateChannelImg,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    authorName: "Gruzli Official",
    likesCount: 24,
    commentsCount: 5,
  },
  {
    id: "placeholder-2",
    author_id: "",
    text: "📧 Email-уведомления — теперь доступны!\n\nБольше не пропускайте заказы и сообщения. Настройте уведомления на почту в разделе Настройки → Уведомления.\n\nПисьма приходят мгновенно с кратким описанием заказа или сообщения.",
    image_url: updateEmailImg,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    authorName: "Gruzli Official",
    likesCount: 18,
    commentsCount: 3,
  },
  {
    id: "placeholder-3",
    author_id: "",
    text: "💬 Обновление чатов!\n\nДобавили отправку фото и голосовых сообщений в личных чатах. Общение стало ещё удобнее.\n\nТакже добавлена возможность подтверждения заказов прямо из чата.",
    image_url: updateChatImg,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    authorName: "Gruzli Official",
    likesCount: 31,
    commentsCount: 8,
  },
];

const ChannelScreen = ({ onBack }: ChannelScreenProps) => {
  const { user, role } = useAuth();
  const canPost = role === "dispatcher" || role === "admin";
  const isAdmin = role === "admin";
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"wall" | "info">("wall");

  // Cover & avatar from app_settings
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("id", "fake_subscribers").single(),
      supabase.from("app_settings").select("value").eq("id", "channel_cover").single(),
      supabase.from("app_settings").select("value").eq("id", "channel_avatar").single(),
    ]).then(([subRes, coverRes, avatarRes]) => {
      if (subRes.data) setSubscriberCount((subRes.data.value as any)?.count ?? null);
      if (coverRes.data) setCoverUrl((coverRes.data.value as any)?.url ?? null);
      if (avatarRes.data) setAvatarUrl((avatarRes.data.value as any)?.url ?? null);
    });
  }, []);

  const uploadImage = async (file: File, key: "channel_cover" | "channel_avatar") => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${key}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Ошибка загрузки"); return; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    const url = urlData?.publicUrl;
    if (!url) return;

    // upsert into app_settings
    const { error } = await supabase.from("app_settings").upsert({ id: key, value: { url } as any });
    if (error) { toast.error("Не удалось сохранить"); return; }

    if (key === "channel_cover") setCoverUrl(url);
    else setAvatarUrl(url);
    toast.success(key === "channel_cover" ? "Шапка обновлена" : "Аватар обновлён");
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, "channel_cover");
    e.target.value = "";
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, "channel_avatar");
    e.target.value = "";
  };

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    const { data: postsData } = await supabase
      .from("channel_posts").select("*").order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) {
      setPosts(placeholderPosts.map(p => ({ ...p, liked: false })));
      setLoading(false);
      return;
    }

    const postIds = postsData.map((p) => p.id);
    const authorIds = [...new Set(postsData.map((p) => p.author_id))];

    const [profilesRes, likesRes, commentsCountRes, userLikesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", authorIds),
      supabase.from("channel_post_likes").select("post_id").in("post_id", postIds),
      supabase.from("channel_post_comments").select("post_id").in("post_id", postIds),
      supabase.from("channel_post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
    ]);

    const profileMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p) => { profileMap[p.user_id] = p.full_name; });
    const likeCounts: Record<string, number> = {};
    (likesRes.data || []).forEach((l) => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1; });
    const commentCounts: Record<string, number> = {};
    (commentsCountRes.data || []).forEach((c) => { commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1; });
    const userLikedSet = new Set((userLikesRes.data || []).map((l) => l.post_id));

    setPosts(postsData.map((p) => ({
      id: p.id, author_id: p.author_id, text: p.text, image_url: p.image_url,
      created_at: p.created_at, authorName: profileMap[p.author_id] || "Gruzli Official",
      likesCount: likeCounts[p.id] || 0, commentsCount: commentCounts[p.id] || 0,
      liked: userLikedSet.has(p.id),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase.channel("channel-posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_post_likes" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_post_comments" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("channel_posts").insert({ author_id: user.id, text: newPostText.trim() });
    setPosting(false);
    if (error) toast.error("Не удалось опубликовать");
    else { setNewPostText(""); setShowCompose(false); toast.success("Пост опубликован"); }
  };

  const handleToggleLike = async (postId: string, liked: boolean) => {
    if (!user || postId.startsWith("placeholder")) return;
    if (liked) await supabase.from("channel_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("channel_post_likes").insert({ post_id: postId, user_id: user.id });
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Удалить пост?")) return;
    await supabase.from("channel_posts").delete().eq("id", postId);
  };

  const fetchComments = async (postId: string) => {
    if (postId.startsWith("placeholder")) { setComments([]); setLoadingComments(false); return; }
    setLoadingComments(true);
    const { data } = await supabase.from("channel_post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (data) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });
      setComments(data.map((c) => ({ id: c.id, user_id: c.user_id, text: c.text, created_at: c.created_at, userName: nameMap[c.user_id] || "Пользователь" })));
    }
    setLoadingComments(false);
  };

  const toggleComments = (postId: string) => {
    if (expandedComments === postId) { setExpandedComments(null); setComments([]); }
    else { setExpandedComments(postId); fetchComments(postId); }
  };

  const handleSendComment = async (postId: string) => {
    if (!newComment.trim() || !user || postId.startsWith("placeholder")) return;
    setSendingComment(true);
    const { error } = await supabase.from("channel_post_comments").insert({ post_id: postId, user_id: user.id, text: newComment.trim() });
    setSendingComment(false);
    if (error) toast.error("Не удалось отправить");
    else { setNewComment(""); fetchComments(postId); }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    await supabase.from("channel_post_comments").delete().eq("id", commentId);
    fetchComments(postId);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffHours = (Date.now() - date.getTime()) / 3600000;
    if (diffHours < 24) return formatDistanceToNow(date, { locale: ru, addSuffix: false });
    return format(date, "d MMM в HH:mm", { locale: ru });
  };

  const memberCount = subscriberCount || 1247;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>
      {/* Hidden file inputs */}
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      {/* Top bar */}
      <div className="shrink-0 bg-card/95 backdrop-blur-xl border-b border-border z-20">
        <div className="flex items-center gap-3 px-4 safe-top pb-2.5">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center active:bg-surface-1 transition-colors">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-foreground truncate">Gruzli Official</span>
              <BadgeCheck size={16} className="text-primary fill-primary/20 shrink-0" />
            </div>
            <p className="text-[11px] text-muted-foreground">сообщество</p>
          </div>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center active:bg-surface-1 transition-colors">
            <MoreHorizontal size={20} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Cover */}
        <div className="relative">
          <div className="h-[120px] overflow-hidden">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <div className="w-full h-full bg-gradient-to-br from-primary/40 via-primary/20 to-accent/30" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.4),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.3),transparent_60%)]" />
              </>
            )}
            {isAdmin && (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center active:bg-black/70 transition-colors"
              >
                <Camera size={14} className="text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Group info card */}
        <div className="relative px-4 -mt-8">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex gap-3.5">
              {/* Avatar */}
              <div className="relative -mt-8">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-lg border-[3px] border-card" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg border-[3px] border-card">
                    <span className="text-2xl font-black text-primary-foreground">G</span>
                  </div>
                )}
                {isAdmin && (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-card"
                  >
                    <Camera size={10} className="text-primary-foreground" />
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-[16px] font-bold text-foreground truncate">Gruzli Official</h1>
                  <BadgeCheck size={16} className="text-primary fill-primary/20 shrink-0" />
                </div>
                <p className="text-[12px] text-muted-foreground">@gruzli_official · сообщество</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-[13px] text-foreground/80 leading-snug mt-3">
              Официальное сообщество платформы Gruzli 🚛
              Обновления, новости и важные объявления для грузчиков и диспетчеров.
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-muted-foreground" />
                <span className="text-[13px] text-foreground font-semibold">{memberCount.toLocaleString("ru-RU")}</span>
                <span className="text-[12px] text-muted-foreground">участников</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Pin size={14} className="text-muted-foreground" />
                <span className="text-[13px] text-foreground font-semibold">{posts.length}</span>
                <span className="text-[12px] text-muted-foreground">постов</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold flex items-center justify-center gap-1.5 active:opacity-80 transition-opacity">
                <Bell size={14} /> Подписаться
              </button>
              <button className="py-2.5 px-4 rounded-xl bg-surface-1 text-muted-foreground text-[13px] font-medium active:opacity-80 transition-opacity">
                <Share size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex border-b border-border mt-3 px-4">
          {([
            { id: "wall" as const, label: "Стена" },
            { id: "info" as const, label: "Информация" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors relative ${
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="channel-tab" className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "info" ? (
          /* Info tab */
          <div className="px-4 py-4 space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-[13px] font-bold text-foreground">О сообществе</h3>
              <p className="text-[13px] text-foreground/70 leading-relaxed">
                Gruzli — платформа для поиска работы в сфере грузоперевозок. Здесь грузчики находят заказы, а диспетчеры — надёжных исполнителей.
              </p>
              <div className="space-y-2.5 pt-1">
                {[
                  { label: "Тип", value: "Сообщество" },
                  { label: "Категория", value: "Работа и бизнес" },
                  { label: "Участников", value: memberCount.toLocaleString("ru-RU") },
                  { label: "Создано", value: "2025" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">{item.label}</span>
                    <span className="text-[12px] text-foreground font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-[13px] font-bold text-foreground mb-2">Контакты</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Settings size={14} className="text-muted-foreground" />
                  <span className="text-[13px] text-foreground">Техническая поддержка — через чат</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Wall tab */
          <>
            {/* Compose (for admins/dispatchers) */}
            {canPost && (
              <>
                <AnimatePresence>
                  {showCompose && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-card border-b border-border">
                        <textarea
                          value={newPostText}
                          onChange={(e) => setNewPostText(e.target.value)}
                          placeholder="Что нового в сообществе?"
                          className="w-full bg-surface-1 border border-border rounded-xl text-[14px] text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[80px] p-3 leading-relaxed"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center justify-between mt-2">
                          <button className="p-2 rounded-lg active:bg-surface-1 transition-colors">
                            <ImageIcon size={18} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={handleCreatePost}
                            disabled={posting || !newPostText.trim()}
                            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold disabled:opacity-40 flex items-center gap-2 active:opacity-80 transition-opacity"
                          >
                            {posting && <Loader2 size={14} className="animate-spin" />}
                            Опубликовать
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!showCompose && (
                  <button
                    onClick={() => setShowCompose(true)}
                    className="w-full px-4 py-3 flex items-center gap-3 bg-card border-b border-border active:bg-surface-1 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary-foreground">G</span>
                      )}
                    </div>
                    <span className="text-[13px] text-muted-foreground">Написать пост...</span>
                  </button>
                )}
              </>
            )}

            {/* Posts */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📢</p>
                <p className="text-[13px] text-muted-foreground">Пока нет постов</p>
              </div>
            ) : (
              <div>
                {posts.map((post, i) => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card border-b border-border"
                  >
                    <div className="px-4 py-3.5">
                      {/* Post header */}
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-primary-foreground">G</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[13px] font-bold text-foreground">Gruzli Official</span>
                            <BadgeCheck size={14} className="text-primary fill-primary/20 shrink-0" />
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatTime(post.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {post.author_id === user?.id && (
                            <button onClick={() => handleDeletePost(post.id)} className="p-2 rounded-lg active:bg-destructive/10 transition-colors">
                              <Trash2 size={14} className="text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Text */}
                      <p className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-[1.5] mb-3">{post.text}</p>

                      {/* Image */}
                      {post.image_url && (
                        <div className="rounded-xl overflow-hidden mb-3">
                          <img src={post.image_url} alt="" className="w-full max-h-[280px] object-cover" loading="lazy" />
                        </div>
                      )}

                      {/* Engagement bar */}
                      <div className="flex items-center gap-1 -mx-2">
                        <button
                          onClick={() => handleToggleLike(post.id, post.liked)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                            post.liked ? "text-red-500" : "text-muted-foreground active:bg-surface-1"
                          }`}
                        >
                          <Heart size={18} className={post.liked ? "fill-red-500" : ""} />
                          {post.likesCount > 0 && <span className="text-[13px] font-medium">{post.likesCount}</span>}
                        </button>

                        <button
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                            expandedComments === post.id ? "text-primary" : "text-muted-foreground active:bg-surface-1"
                          }`}
                        >
                          <MessageCircle size={18} />
                          {post.commentsCount > 0 && <span className="text-[13px] font-medium">{post.commentsCount}</span>}
                        </button>

                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground active:bg-surface-1 transition-colors">
                          <Share size={16} />
                        </button>

                        <div className="ml-auto flex items-center gap-1 text-muted-foreground/50">
                          <Eye size={14} />
                          <span className="text-[11px]">{fakeViews(post.id).toLocaleString("ru-RU")}</span>
                        </div>
                      </div>

                      {/* Comments */}
                      <AnimatePresence>
                        {expandedComments === post.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 pt-3 border-t border-border space-y-3">
                              {loadingComments ? (
                                <div className="flex justify-center py-3">
                                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                </div>
                              ) : comments.length === 0 ? (
                                <p className="text-[13px] text-muted-foreground text-center py-2">Нет комментариев</p>
                              ) : (
                                comments.map((c) => (
                                  <div key={c.id} className="flex gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-surface-1 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                      {c.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 bg-surface-1 rounded-xl px-3 py-2">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[12px] font-bold text-foreground">{c.userName}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {format(new Date(c.created_at), "HH:mm", { locale: ru })}
                                        </span>
                                        {c.user_id === user?.id && (
                                          <button onClick={() => handleDeleteComment(c.id, post.id)} className="ml-auto p-1 rounded-full active:bg-destructive/10">
                                            <Trash2 size={11} className="text-muted-foreground" />
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-[13px] text-foreground/80 leading-snug">{c.text}</p>
                                    </div>
                                  </div>
                                ))
                              )}

                              {/* Comment input */}
                              <div className="flex gap-2 pt-1">
                                <input
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="Комментарий..."
                                  className="flex-1 bg-surface-1 border border-border rounded-xl py-2.5 px-3.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
                                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(post.id); } }}
                                />
                                <button
                                  onClick={() => handleSendComment(post.id)}
                                  disabled={sendingComment || !newComment.trim()}
                                  className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 transition"
                                >
                                  {sendingComment ? <Loader2 size={12} className="animate-spin text-primary-foreground" /> : <Send size={14} className="text-primary-foreground" />}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.article>
                ))}

                <div className="py-8 text-center">
                  <p className="text-[12px] text-muted-foreground">Показаны все записи</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChannelScreen;
