import { memo } from "react";
import { motion } from "framer-motion";

// Text-based sticker packs (large emoji combos displayed big)
const STICKERS = [
  "🔥💪", "😂👍", "❤️🥰", "🎉🥳", "👋😊",
  "💰📦", "🚛💨", "🏗️⚡", "☕😎", "🤝✅",
  "😤💢", "😭💔", "🫡👏", "🙏⭐", "🤯🔥",
  "💀😈", "🥺🙏", "👻🎃", "🍕🍺", "💯🏆",
];

interface StickerPickerProps {
  onSelect: (sticker: string) => void;
}

const StickerPicker = memo(({ onSelect }: StickerPickerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl"
    >
      <div className="px-3 py-2 border-b border-border/30">
        <span className="text-xs font-semibold text-muted-foreground">Стикеры</span>
      </div>
      <div className="grid grid-cols-5 gap-1 p-2 max-h-[200px] overflow-y-auto scrollbar-hide">
        {STICKERS.map((sticker) => (
          <button
            key={sticker}
            onClick={() => onSelect(sticker)}
            className="aspect-square flex items-center justify-center text-3xl rounded-xl hover:bg-muted/50 active:scale-90 transition-all"
          >
            {sticker}
          </button>
        ))}
      </div>
    </motion.div>
  );
});
StickerPicker.displayName = "StickerPicker";

export default StickerPicker;
