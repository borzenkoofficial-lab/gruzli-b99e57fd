import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Shield, MessageSquare, Hash, Copy, CheckCircle2 } from "lucide-react";
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

const UserProfileScreen = ({ userId, onBack, onChat }: UserProfileScreenProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [postedJobsCount, setPostedJobsCount] = useState(0);
  const [idCopied, setIdCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(profileData);

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      setUserRole(roleData?.role || null);

      // Fetch reviews if dispatcher
      if (roleData?.role === "dispatcher") {
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
          setReviews(reviewsData.map((r: any) => ({ ...r, reviewer_name: nameMap[r.reviewer_id] || "Исполнитель" })));
          const avg = reviewsData.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsData.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [userId]);

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
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${reviews.length > 0
                          ? (reviews.filter((r) => r.rating >= s).length / reviews.length) * 100
                          : (s <= Math.round(profile.rating || 5) ? 100 : 0)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
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
              {reviews.slice(0, 5).map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="neu-card rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">{review.reviewer_name}</span>
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat button (if not own profile) */}
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
