import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Send, Loader2, Trash2, Repeat2, Share, MoreHorizontal, BadgeCheck } from "lucide-react";
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

// Placeholder posts shown when DB is empty
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
  const isDispatcher = role === "dispatcher";
  const canPost = role === "dispatcher" || role === "admin";
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

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("id", "fake_subscribers")
      .single()
      .then(({ data }) => {
        if (data) setSubscriberCount((data.value as any)?.count ?? null);
      });
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!user) return;

    const { data: postsData } = await supabase
      .from("channel_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) {
      // Show placeholder posts
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
      id: p.id,
      author_id: p.author_id,
      text: p.text,
      image_url: p.image_url,
      created_at: p.created_at,
      authorName: profileMap[p.author_id] || "Gruzli Official",
      likesCount: likeCounts[p.id] || 0,
      commentsCount: commentCounts[p.id] || 0,
      liked: userLikedSet.has(p.id),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase
      .channel("channel-posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_post_likes" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_post_comments" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("channel_posts").insert({
      author_id: user.id,
      text: newPostText.trim(),
    });
    setPosting(false);
    if (error) {
      toast.error("Не удалось опубликовать");
    } else {
      setNewPostText("");
      setShowCompose(false);
      toast.success("Пост опубликован");
    }
  };

  const handleToggleLike = async (postId: string, liked: boolean) => {
    if (!user || postId.startsWith("placeholder")) return;
    if (liked) {
      await supabase.from("channel_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("channel_post_likes").insert({ post_id: postId, user_id: user.id });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Удалить пост?")) return;
    await supabase.from("channel_posts").delete().eq("id", postId);
  };

  const fetchComments = async (postId: string) => {
    if (postId.startsWith("placeholder")) { setComments([]); setLoadingComments(false); return; }
    setLoadingComments(true);
    const { data } = await supabase
      .from("channel_post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

      setComments(data.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        text: c.text,
        created_at: c.created_at,
        userName: nameMap[c.user_id] || "Пользователь",
      })));
    }
    setLoadingComments(false);
  };

  const toggleComments = (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
      setComments([]);
    } else {
      setExpandedComments(postId);
      fetchComments(postId);
    }
  };

  const handleSendComment = async (postId: string) => {
    if (!newComment.trim() || !user || postId.startsWith("placeholder")) return;
    setSendingComment(true);
    const { error } = await supabase.from("channel_post_comments").insert({
      post_id: postId,
      user_id: user.id,
      text: newComment.trim(),
    });
    setSendingComment(false);
    if (error) {
      toast.error("Не удалось отправить");
    } else {
      setNewComment("");
      fetchComments(postId);
    }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    await supabase.from("channel_post_comments").delete().eq("id", commentId);
    fetchComments(postId);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / 3600000;
    if (diffHours < 24) {
      return formatDistanceToNow(date, { locale: ru, addSuffix: false });
    }
    return format(date, "d MMM", { locale: ru });
  };

  return (
    <div className="flex flex-col h-[var(--app-height)] bg-background overflow-hidden">
      {/* Back button bar - fixed */}
      <div className="shrink-0 bg-background/95 backdrop-blur-xl border-b border-border z-20">
        <div className="flex items-center gap-3 px-4 safe-top pb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary/60 transition-colors active:scale-95">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[17px] font-extrabold text-foreground">Gruzli Official</h1>
              <BadgeCheck size={18} className="text-primary fill-primary/20" />
            </div>
            <p className="text-[12px] text-muted-foreground">
              {subscriberCount ? `${subscriberCount.toLocaleString("ru-RU")} подписчиков · ` : ""}{posts.length} постов
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Channel banner */}
        <div className="relative h-[100px] bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.3),transparent_70%)]" />
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <div className="w-14 h-14 rounded-full border-[3px] border-background bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <span className="text-xl font-black text-primary-foreground">G</span>
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-foreground drop-shadow">Gruzli Official</span>
                <BadgeCheck size={14} className="text-primary" />
              </div>
              <span className="text-[11px] text-foreground/60">@gruzli_official</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[13px] text-foreground/80 leading-snug">
            Официальный канал платформы Gruzli 🚛 Обновления, новости и важные объявления.
          </p>
        </div>

      {/* Compose button for dispatchers and admins */}
      {canPost && (
        <>
          <AnimatePresence>
            {showCompose && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-border"
              >
                <div className="px-4 py-3">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary-foreground">G</span>
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newPostText}
                        onChange={(e) => setNewPostText(e.target.value)}
                        placeholder="Что нового?"
                        className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[80px] leading-relaxed"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex gap-2">
                          {/* Future: image upload buttons */}
                        </div>
                        <button
                          onClick={handleCreatePost}
                          disabled={posting || !newPostText.trim()}
                          className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 flex items-center gap-2 hover:bg-primary/90 transition-colors"
                        >
                          {posting ? <Loader2 size={14} className="animate-spin" /> : null}
                          Опубликовать
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showCompose && (
            <button
              onClick={() => setShowCompose(true)}
              className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-all active:scale-90"
            >
              <Send size={20} />
            </button>
          )}
        </>
      )}

      {/* Posts feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-sm text-muted-foreground">Пока нет постов</p>
        </div>
      ) : (
        <div>
          {posts.map((post, i) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="border-b border-border hover:bg-secondary/20 transition-colors"
            >
              <div className="px-4 py-3">
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-foreground">G</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[14px] font-bold text-foreground truncate">Gruzli Official</span>
                      <BadgeCheck size={15} className="text-primary fill-primary/20 shrink-0" />
                      <span className="text-[13px] text-muted-foreground truncate">@gruzli</span>
                      <span className="text-muted-foreground text-[13px]">·</span>
                      <span className="text-[13px] text-muted-foreground shrink-0">{formatTime(post.created_at)}</span>
                      <div className="ml-auto flex items-center">
                        {post.author_id === user?.id && (
                          <button onClick={() => handleDeletePost(post.id)} className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors">
                            <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                        <button className="p-1.5 rounded-full hover:bg-primary/10 transition-colors">
                          <MoreHorizontal size={15} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Text */}
                    <p className="text-[14.5px] text-foreground/90 whitespace-pre-wrap leading-[1.45] mb-2.5">{post.text}</p>

                    {/* Image */}
                    {post.image_url && (
                      <div className="rounded-2xl overflow-hidden border border-border mb-2.5">
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-full max-h-[300px] object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="flex items-center justify-between max-w-[360px] -ml-2">
                      <button
                        onClick={() => toggleComments(post.id)}
                        className="group flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
                      >
                        <MessageCircle
                          size={17}
                          className={`transition-colors ${expandedComments === post.id ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}
                        />
                        <span className={`text-[13px] ${expandedComments === post.id ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
                          {post.commentsCount > 0 ? post.commentsCount : ""}
                        </span>
                      </button>

                      <button className="group flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-green-500/10 transition-colors">
                        <Repeat2 size={17} className="text-muted-foreground group-hover:text-green-500 transition-colors" />
                      </button>

                      <button
                        onClick={() => handleToggleLike(post.id, post.liked)}
                        className="group flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-red-500/10 transition-colors"
                      >
                        <Heart
                          size={17}
                          className={`transition-colors ${post.liked ? "text-red-500 fill-red-500" : "text-muted-foreground group-hover:text-red-500"}`}
                        />
                        <span className={`text-[13px] transition-colors ${post.liked ? "text-red-500" : "text-muted-foreground group-hover:text-red-500"}`}>
                          {post.likesCount > 0 ? post.likesCount : ""}
                        </span>
                      </button>

                      <button className="group flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
                        <Share size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
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
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-3">
                            {loadingComments ? (
                              <div className="flex justify-center py-3">
                                <Loader2 size={16} className="animate-spin text-muted-foreground" />
                              </div>
                            ) : comments.length === 0 ? (
                              <p className="text-[13px] text-muted-foreground text-center py-2">Нет комментариев</p>
                            ) : (
                              comments.map((c) => (
                                <div key={c.id} className="flex gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                    {c.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-bold text-foreground">{c.userName}</span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {format(new Date(c.created_at), "HH:mm", { locale: ru })}
                                      </span>
                                      {c.user_id === user?.id && (
                                        <button onClick={() => handleDeleteComment(c.id, post.id)} className="ml-auto p-1 rounded-full hover:bg-destructive/10">
                                          <Trash2 size={11} className="text-muted-foreground hover:text-destructive" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-[13px] text-foreground/80 mt-0.5 leading-snug">{c.text}</p>
                                  </div>
                                </div>
                              ))
                            )}

                            {/* Comment input */}
                            <div className="flex gap-2 pt-1">
                              <input
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Написать комментарий..."
                                className="flex-1 bg-secondary/60 rounded-full py-2 px-4 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 transition"
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(post.id); } }}
                              />
                              <button
                                onClick={() => handleSendComment(post.id)}
                                disabled={sendingComment || !newComment.trim()}
                                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition"
                              >
                                {sendingComment ? <Loader2 size={12} className="animate-spin text-primary-foreground" /> : <Send size={13} className="text-primary-foreground" />}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
      </div>{/* end scrollable content */}
    </div>
  );
};

export default ChannelScreen;
