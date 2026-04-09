import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Send, Loader2, Trash2, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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

const ChannelScreen = ({ onBack }: ChannelScreenProps) => {
  const { user, role } = useAuth();
  const isDispatcher = role === "dispatcher";
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const fetchPosts = useCallback(async () => {
    if (!user) return;

    const { data: postsData } = await supabase
      .from("channel_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!postsData) { setLoading(false); return; }

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
      authorName: profileMap[p.author_id] || "Администратор",
      likesCount: likeCounts[p.id] || 0,
      commentsCount: commentCounts[p.id] || 0,
      liked: userLikedSet.has(p.id),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Realtime updates
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
      toast.success("Пост опубликован");
    }
  };

  const handleToggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
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
    if (!newComment.trim() || !user) return;
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

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-14 pb-4">
          <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">📢 Gruzli Official</h1>
            <p className="text-[11px] text-muted-foreground">Официальный канал</p>
          </div>
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            G
          </div>
        </div>
      </div>

      {/* New post (dispatcher only) */}
      {isDispatcher && (
        <div className="px-4 py-3 border-b border-border">
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="Написать пост..."
            className="w-full neu-inset rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[60px]"
            rows={2}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleCreatePost}
              disabled={posting || !newPostText.trim()}
              className="px-5 py-2.5 rounded-2xl gradient-primary text-primary-foreground text-xs font-bold disabled:opacity-50 flex items-center gap-2"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Опубликовать
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-sm text-muted-foreground">Пока нет постов</p>
        </div>
      ) : (
        <div className="space-y-0">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border-b border-border"
            >
              <div className="px-4 py-4">
                {/* Post header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                    G
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Gruzli Official</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(post.created_at), "d MMM yyyy, HH:mm", { locale: ru })}
                    </p>
                  </div>
                  {post.author_id === user?.id && (
                    <button onClick={() => handleDeletePost(post.id)} className="p-2 rounded-xl hover:bg-destructive/10 transition">
                      <Trash2 size={14} className="text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Post content */}
                <div className="mb-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.text}</p>
                </div>

                {post.image_url && (
                  <img src={post.image_url} alt="" className="w-full rounded-xl mb-3 max-h-80 object-cover" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleToggleLike(post.id, post.liked)}
                    className="flex items-center gap-1.5 transition-colors"
                  >
                    <Heart
                      size={18}
                      className={post.liked ? "text-red-500 fill-red-500" : "text-muted-foreground"}
                    />
                    <span className={`text-xs font-medium ${post.liked ? "text-red-500" : "text-muted-foreground"}`}>
                      {post.likesCount > 0 ? post.likesCount : ""}
                    </span>
                  </button>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 transition-colors"
                  >
                    <MessageCircle
                      size={18}
                      className={expandedComments === post.id ? "text-primary" : "text-muted-foreground"}
                    />
                    <span className={`text-xs font-medium ${expandedComments === post.id ? "text-primary" : "text-muted-foreground"}`}>
                      {post.commentsCount > 0 ? post.commentsCount : ""}
                    </span>
                  </button>
                </div>

                {/* Comments section */}
                <AnimatePresence>
                  {expandedComments === post.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border space-y-2.5">
                        {loadingComments ? (
                          <div className="flex justify-center py-3">
                            <Loader2 size={16} className="animate-spin text-muted-foreground" />
                          </div>
                        ) : comments.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">Нет комментариев</p>
                        ) : (
                          comments.map((c) => (
                            <div key={c.id} className="flex gap-2.5">
                              <div className="w-7 h-7 rounded-full neu-raised flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                                {c.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground">{c.userName}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(c.created_at), "HH:mm", { locale: ru })}
                                  </span>
                                  {c.user_id === user?.id && (
                                    <button onClick={() => handleDeleteComment(c.id, post.id)} className="ml-auto">
                                      <Trash2 size={11} className="text-muted-foreground hover:text-destructive transition" />
                                    </button>
                                  )}
                                </div>
                                <p className="text-xs text-foreground/80 mt-0.5">{c.text}</p>
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
                            className="flex-1 neu-inset rounded-xl py-2 px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(post.id); } }}
                          />
                          <button
                            onClick={() => handleSendComment(post.id)}
                            disabled={sendingComment || !newComment.trim()}
                            className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center disabled:opacity-50"
                          >
                            {sendingComment ? <Loader2 size={12} className="animate-spin text-primary-foreground" /> : <Send size={12} className="text-primary-foreground" />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChannelScreen;
