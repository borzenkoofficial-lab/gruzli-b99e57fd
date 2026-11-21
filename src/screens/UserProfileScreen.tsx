import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Shield, MessageSquare, Hash, Copy, CheckCircle2, ThumbsUp, ThumbsDown, Minus, Send, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";

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
  const [loadError, setLoadError] = useState(false);

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
        .from("profiles_public" as any)
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
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);

      // Parallelize the two independent base queries — was sequential, costing ~2x latency.
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles_public" as any).select("*").eq("user_id", userId).single(),
        supabase.rpc("get_user_role", { _user_id: userId }),
      ]);

      if (cancelled) return;

      if (profileRes.error && profileRes.error.code !== "PGRST116") {
        console.error("[Gruzli PublicProfile] profile query failed:", profileRes.error);
        setLoadError(true);
      }
      if (roleRes.error) {
        console.error("[Gruzli PublicProfile] role query failed:", roleRes.error);
        setLoadError(true);
      }

      setProfile(profileRes.data);
      const detectedRole = roleRes.data || null;
      setUserRole(detectedRole);

      // Show the screen as soon as base data is in — reviews & jobs count
      // can stream in afterwards without blocking the whole UI.
      setLoading(false);

      if (detectedRole === "dispatcher") {
        const [{ count }] = await Promise.all([
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("dispatcher_id", userId),
          fetchReviews(),
        ]);
        if (!cancelled) setPostedJobsCount(count || 0);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [userId]);

  const handleSentimentSelect = (sentiment: ReviewSentiment) => {
    setSelectedSentiment(sentiment);
    setReviewStars(SENTIMENT_CONFIG[sentiment].rating);
  };

  const submitReview = async () => {
    if (!user || !selectedSentiment || submittingReview) return;
    setSubmittingReview(true);

    try {
      const { error } = await supabase.rpc("worker_review_dispatcher", {
        _dispatcher_id: userId,
        _rating: reviewStars,
        _text: reviewText || null,
      });
      if (error) throw error;
      toast.success(existingReview ? "Отзыв обновлён" : "Отзыв отправлен");

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
    return <ProfileSkeleton onBack={onBack} />;
  }

  if (!profile) {
    return (
      <div className="min-h-full bg-background">
        <div className="flex items-center gap-3 px-4 safe-top pb-4">
          <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h2 className="text-base font-bold text-foreground">Профиль</h2>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">{loadError ? "Не удалось загрузить профиль. Попробуйте ещё раз." : "Профиль не найден"}</div>
      </div>
    );
  }

  const isDispatcher = userRole === "dispatcher";
  const isClient = userRole === "client";
  const isAdminAccount = userRole === "admin";

  // Stats for rating bar
  const positiveCount = reviews.filter(r => r.rating >= 4).length;
  const neutralCount = reviews.filter(r => r.rating === 3).length;
  const negativeCount = reviews.filter(r => r.rating <= 2).length;
  const isWorker = userRole === "worker";
  const completedOrders = Number(profile.completed_orders || 0);
  const workerRating = profile.rating == null
    ? (isDispatcher && reviews.length > 0 ? avgRating : null)
    : Number(profile.rating);
  const workerRatingLabel = workerRating == null ? "—" : workerRating.toFixed(1);
  const workerSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const lastSeenMs = profile.last_seen_at ? Date.parse(profile.last_seen_at) : Number.NaN;
  const lastSeenAge = Date.now() - lastSeenMs;
  const workerStatus =
    Number.isFinite(lastSeenMs) && lastSeenAge >= 0 && lastSeenAge <= 2 * 60 * 1000
      ? "Сейчас в сети"
      : profile.last_seen_at ? "Не в сети" : "Статус не указан";

  return (
    <div className="min-h-full bg-background animate-fade-in pb-[calc(var(--bottom-nav-height,80px)+env(safe-area-inset-bottom,0px)+32px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground flex-1">Профиль</h2>
      </div>

      {/* Avatar & Name */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="rounded-full object-cover" style={{ width: 72, height: 72 }} />
          ) : (
            <div
              className="rounded-full bg-foreground flex items-center justify-center text-2xl font-bold text-primary-foreground"
              style={{ width: 72, height: 72 }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-foreground">{profile.full_name || "Пользователь"}</h2>
              {isAdminAccount && <BadgeCheck size={18} className="text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAdminAccount ? "Официальный аккаунт Gruzli" : `@${profile.full_name?.toLowerCase().replace(/\s+/g, "_") || "user"}`}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={12} className="text-primary" />
              <span className="text-xs text-primary font-semibold">
                {isAdminAccount ? "Администрация" : isDispatcher ? "Диспетчер" : isWorker ? "Грузчик" : isClient ? "Заказчик" : "Участник Gruzli"}
              </span>
              {profile.verified && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-bold">✓ Верифицирован</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Worker dossier — the dispatcher-facing profile */}
      {isWorker && (
        <div className="mx-5 mb-4">
          <motion.div
            className="gruzli-worker-dossier"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .45 }}
          >
            <div className="gruzli-worker-dossier-head">
              <span>GRUZLI / WORKER DOSSIER</span>
              <span>{workerStatus}</span>
            </div>

            <div className="gruzli-worker-dossier-identity">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="gruzli-worker-dossier-avatar" />
              ) : (
                <div className="gruzli-worker-dossier-avatar gruzli-worker-dossier-avatar-fallback">{initials}</div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3>{profile.full_name || "Грузчик"}</h3>
                  {profile.verified && <BadgeCheck size={16} />}
                </div>
                <p>ИДЕНТИФИКАТОР / {shortId}</p>
              </div>
            </div>

            <div className="gruzli-worker-dossier-rating">
              <div>
                <span>РЕЙТИНГ</span>
                <strong>{workerRatingLabel} <Star size={14} /></strong>
              </div>
              <div>
                <span>ЗАКАЗЫ</span>
                <strong>{completedOrders}</strong>
              </div>
              <div>
                <span>СТАТУС</span>
                <strong>{workerStatus}</strong>
              </div>
            </div>

            {workerSkills.length > 0 && (
              <div className="gruzli-worker-dossier-skills">
                {workerSkills.slice(0, 5).map((skill: string) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            )}

            <div className="gruzli-worker-dossier-actions">
              {onChat && (
                <button
                  onClick={() => onChat(userId, profile.full_name || "Грузчик")}
                  className="gruzli-worker-dossier-primary"
                >
                  <MessageSquare size={15} />
                  Написать
                </button>
              )}
              <button onClick={copyId} className="gruzli-worker-dossier-secondary">
                {idCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                ID
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ID Card */}
      <div className="mx-5 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash size={16} className="text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">ID пользователя</span>
            </div>
            <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border tap-scale transition-colors">
              {idCopied ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
              <span className="text-sm font-bold text-foreground tracking-wider">{shortId}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="mx-5 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-foreground">Рейтинг</span>
            <div className="flex items-center gap-1">
              <Star size={16} className="text-primary fill-primary" />
              <span className="text-lg font-extrabold text-foreground">
                {isDispatcher && reviews.length > 0 ? avgRating.toFixed(1) : profile.rating == null ? "—" : Number(profile.rating).toFixed(1)}
              </span>
            </div>
          </div>
          {isWorker && (
            <p className="text-[11px] text-muted-foreground">
              {completedOrders} выполненных заказов
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
      {isWorker && profile.skills?.length > 0 && (
        <div className="mx-5 mb-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Навыки</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill: string) => (
              <span key={skill} className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground">
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
            className="w-full py-3 rounded-2xl bg-card border border-border text-sm font-bold text-foreground active:bg-surface-1 border border-border transition-all flex items-center justify-center gap-2"
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
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
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
                        isActive ? `${config.bg} ${config.color}` : "bg-card border border-border text-muted-foreground active:bg-surface-1 border border-border"
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
                    className="w-full p-3 rounded-xl bg-surface-1 border border-border bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
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
                    className="w-full py-3 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
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
                    className="bg-card border border-border rounded-2xl p-4"
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
            className="w-full py-3.5 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale"
          >
            💬 Написать сообщение
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfileScreen;