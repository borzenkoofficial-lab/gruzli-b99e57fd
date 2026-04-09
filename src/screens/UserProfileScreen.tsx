import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Shield, MessageSquare, Hash, Copy, CheckCircle2, ThumbsUp, ThumbsDown, Minus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface UserProfileScreenProps {
  userId: string;
  onBack: () => void;
  onChat?: (userId: string, name: string) => void;
}

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  text: string;
  created_at: string;
  reviewer_name?: string;
}

type ReviewSentiment = "positive" | "neutral" | "negative";

const SENTIMENT_CONFIG: Record<ReviewSentiment, { label: string; icon: typeof ThumbsUp; rating: number; color: string; bg: string }> = {
  positive: { label: "Положительный", icon: ThumbsUp, rating: 5, color: "text-green-500", bg: "bg-green-500/15" },
  neutral: { label: "Средний", icon: Minus, rating: 3, color: "text-yellow-500", bg: "bg-yellow-500/15" },
  negative: { label: "Негативный", icon: ThumbsDown, rating: 1, color: "text-red-500", bg: "bg-red-500/15" },
};

const getReviewSentiment = (rating: number): ReviewSentiment => {
  if (rating >= 4) return "positive";
  if (rating >= 3) return "neutral";
  return "negative";
};

const UserProfileScreen = ({ userId, onBack, onChat }: UserProfileScreenProps) => {
  const { user, role: myRole } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [postedJobsCount, setPostedJobsCount] = useState(0);
  const [idCopied, setIdCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedSentiment, setSelectedSentiment] = useState<ReviewSentiment | null>(null);
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  const isOwnProfile = user?.id === userId;
  const canReview = !isOwnProfile && myRole === "worker" && userRole === "dispatcher";

  const fetchReviews = async () => {
    const { data: reviewsData } = await supabase
      .from("dispatcher_reviews")
      .select("*")
      .eq("dispatcher_id", userId)
      .order("created_at", { ascending: false });

    if (reviewsData && reviewsData.length > 0) {
      const reviewerIds = [...new Set(reviewsData.map((r: any) => r.reviewer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", reviewerIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name; });
      const mapped = reviewsData.map((r: any) => ({ ...r, reviewer_name: nameMap[r.reviewer_id] || "Исполнитель" }));
      setReviews(mapped);
      const avg = reviewsData.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsData.length;
      setAvgRating(Math.round(avg * 10) / 10);

      // Check if current user already left a review
      if (user) {
        const mine = mapped.find((r: Review) => r.reviewer_id === user.id);
        if (mine) setExistingReview(mine);
      }
    } else {
      setReviews([]);
      setAvgRating(0);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(profileData);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      setUserRole(roleData?.role || null);

      if (roleData?.role === "dispatcher") {
        const { count } = await supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("dispatcher_id", userId);
        setPostedJobsCount(count || 0);

        await fetchReviews();
      }

      setLoading(false);
    };
    fetchData();
  }, [userId]);

  const handleSentimentSelect = (sentiment: ReviewSentiment) => {
    setSelectedSentiment(sentiment);
    setReviewStars(SENTIMENT_CONFIG[sentiment].rating);
  };

  const submitReview = async () => {
    if (!user || !selectedSentiment || submittingReview) return;
    setSubmittingReview(true);

    try {
      if (existingReview) {
        const { error } = await supabase
          .from("dispatcher_reviews")
          .update({ rating: reviewStars, text: reviewText })
          .eq("id", existingReview.id);
        if (error) throw error;
        toast.success("Отзыв обновлён");
      } else {
        const { error } = await supabase
          .from("dispatcher_reviews")
          .insert({ reviewer_id: user.id, dispatcher_id: userId, rating: reviewStars, text: reviewText });
        if (error) throw error;
        toast.success("Отзыв отправлен");
      }

      await fetchReviews();
      setShowReviewForm(false);
      setSelectedSentiment(null);
      setReviewStars(0);
      setReviewText("");
    } catch (e: any) {
      toast.error(e.message || "Ошибка отправки");
    } finally {
      setSubmittingReview(false);
    }
  };

  const initials = (profile?.full_name || "")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const shortId = userId.slice(0, 8).toUpperCase();

  const copyId = () => {
    navigator.clipboard.writeText(shortId);
    setIdCopied(true);
    toast.success("ID скопирован");
    setTimeout(() => setIdCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Загрузка профиля...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-3 px-4 pt-14 pb-4">
          <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h2 className="text-base font-bold text-foreground">Профиль</h2>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">Профиль не найден</div>
      </div>
    );
  }

  const isDispatcher = userRole === "dispatcher";

  // Stats for rating bar
  const positiveCount = reviews.filter(r => r.rating >= 4).length;
  const neutralCount = reviews.filter(r => r.rating === 3).length;
  const negativeCount = reviews.filter(r => r.rating <= 2).length;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground flex-1">Профиль</h2>
      </div>

      {/* Avatar & Name */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div
            className="rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground"
            style={{ width: 72, height: 72 }}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{profile.full_name || "Пользователь"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              @{profile.full_name?.toLowerCase().replace(/\s+/g, "_") || "user"}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={12} className="text-primary" />
              <span className="text-xs text-primary font-semibold">
                {isDispatcher ? "Диспетчер" : "Грузчик"}
              </span>
              {profile.verified && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-bold">✓ Верифицирован</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ID Card */}
      <div className="mx-5 mb-4">
        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash size={16} className="text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">ID пользователя</span>
            </div>
            <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-raised-sm active:neu-inset transition-all">
              {idCopied ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
              <span className="text-sm font-bold text-foreground tracking-wider">{shortId}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="mx-5 mb-4">
        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-foreground">Рейтинг</span>
            <div className="flex items-center gap-1">
              <Star size={16} className="text-primary fill-primary" />
              <span className="text-lg font-extrabold text-foreground">
                {isDispatcher ? (avgRating || profile.rating || "5.0") : (profile.rating || "5.0")}
              </span>
            </div>
          </div>
          {!isDispatcher && (
            <p className="text-[11px] text-muted-foreground">
              {profile.completed_orders || 0} выполненных заказов
            </p>
          )}
          {isDispatcher && (
            <>
              <p className="text-[11px] text-muted-foreground mb-2">
                {postedJobsCount} размещённых заказов
              </p>
              {/* Sentiment breakdown */}
              {reviews.length > 0 && (
                <div className="space-y-1.5">
                  {[
                    { label: "Положительные", count: positiveCount, color: "bg-green-500" },
                    { label: "Средние", count: neutralCount, color: "bg-yellow-500" },
                    { label: "Негативные", count: negativeCount, color: "bg-red-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-24">{item.label}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${(item.count / reviews.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-5 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                {reviews.length > 0 ? `На основе ${reviews.length} отзывов` : "Пока нет отзывов"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Skills for worker */}
      {!isDispatcher && profile.skills?.length > 0 && (
        <div className="mx-5 mb-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Навыки</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill: string) => (
              <span key={skill} className="px-3 py-2 rounded-xl neu-raised-sm text-xs font-medium text-muted-foreground">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Write review button */}
      {canReview && (
        <div className="mx-5 mb-4">
          <button
            onClick={() => {
              setShowReviewForm(!showReviewForm);
              if (existingReview) {
                setReviewStars(existingReview.rating);
                setReviewText(existingReview.text || "");
                setSelectedSentiment(getReviewSentiment(existingReview.rating));
              }
            }}
            className="w-full py-3 rounded-2xl neu-raised text-sm font-bold text-foreground active:neu-inset transition-all flex items-center justify-center gap-2"
          >
            <Star size={14} className="text-primary" />
            {existingReview ? "Изменить отзыв" : "Оставить отзыв"}
          </button>
        </div>
      )}

      {/* Review Form */}
      <AnimatePresence>
        {showReviewForm && canReview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-5 mb-4 overflow-hidden"
          >
            <div className="neu-card rounded-2xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-foreground">Ваша оценка</h3>

              {/* Sentiment buttons */}
              <div className="flex gap-2">
                {(Object.entries(SENTIMENT_CONFIG) as [ReviewSentiment, typeof SENTIMENT_CONFIG["positive"]][]).map(([key, config]) => {
                  const Icon = config.icon;
                  const isActive = selectedSentiment === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSentimentSelect(key)}
                      className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-1.5 ${
                        isActive ? `${config.bg} ${config.color}` : "neu-raised-sm text-muted-foreground active:neu-inset"
                      }`}
                    >
                      <Icon size={18} />
                      {config.label}
                    </button>
                  );
                })}
              </div>

              {/* Star fine-tune */}
              {selectedSentiment && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Точная оценка</p>
                  <div className="flex gap-1.5 justify-center">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setReviewStars(s)} className="p-1.5">
                        <Star
                          size={24}
                          className={`transition-colors ${s <= reviewStars ? "text-primary fill-primary" : "text-muted"}`}
                        />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Text */}
              {selectedSentiment && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Напишите отзыв (необязательно)..."
                    className="w-full p-3 rounded-xl neu-inset bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
                    rows={3}
                  />
                </motion.div>
              )}

              {/* Submit */}
              {selectedSentiment && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <button
                    onClick={submitReview}
                    disabled={submittingReview || reviewStars === 0}
                    className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={14} />
                    {submittingReview ? "Отправка..." : existingReview ? "Обновить отзыв" : "Отправить отзыв"}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews for dispatcher */}
      {isDispatcher && (
        <div className="mx-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare size={14} className="text-primary" />
            Отзывы
          </h2>
          {reviews.length === 0 ? (
            <div className="neu-card rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Отзывов пока нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map((review) => {
                const sentiment = getReviewSentiment(review.rating);
                const config = SENTIMENT_CONFIG[sentiment];
                const SentimentIcon = config.icon;
                return (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neu-card rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full ${config.bg} flex items-center justify-center`}>
                          <SentimentIcon size={10} className={config.color} />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{review.reviewer_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} className={i < review.rating ? "text-primary fill-primary" : "text-muted"} />
                        ))}
                      </div>
                    </div>
                    {review.text && <p className="text-xs text-muted-foreground">{review.text}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(review.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chat button */}
      {!isOwnProfile && onChat && (
        <div className="mx-5 mt-4">
          <button
            onClick={() => onChat(userId, profile.full_name || "Пользователь")}
            className="w-full py-3.5 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
          >
            💬 Написать сообщение
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfileScreen;