import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STORAGE_KEY = "app_rating_state";
const SHOW_AFTER_MS = 30 * 60 * 1000; // 30 minutes

interface RatingState {
  rated: boolean;
  dismissedAt?: number;
  sessionStart: number;
}

const AppRatingModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    let state: RatingState;

    if (raw) {
      state = JSON.parse(raw);
      if (state.rated) return;
      // If dismissed less than 7 days ago, skip
      if (state.dismissedAt && Date.now() - state.dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    } else {
      state = { rated: false, sessionStart: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    const elapsed = Date.now() - state.sessionStart;
    const remaining = Math.max(0, SHOW_AFTER_MS - elapsed);

    const timer = setTimeout(() => setOpen(true), remaining);
    return () => clearTimeout(timer);
  }, [user]);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("app_ratings").insert({
      user_id: user.id,
      rating,
      feedback: feedback.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Ошибка отправки");
    } else {
      toast.success("Спасибо за оценку!");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rated: true }));
      setOpen(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rated: false, dismissedAt: Date.now(), sessionStart: Date.now() }));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Оцените приложение</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Ваше мнение помогает нам стать лучше
          </p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    s <= (hover || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Что можно улучшить? Какие ошибки встречаете?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSubmit} disabled={rating === 0 || submitting} className="w-full">
            Отправить
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full text-muted-foreground">
            Позже
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppRatingModal;
