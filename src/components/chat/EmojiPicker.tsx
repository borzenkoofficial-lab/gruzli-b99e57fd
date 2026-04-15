import { useState, memo } from "react";
import { motion } from "framer-motion";

const EMOJI_CATEGORIES = [
  { label: "😀", emojis: ["😀","😂","🤣","😊","😍","🥰","😘","😋","🤪","😎","🥳","🤩","😢","😭","😤","😡","🥺","😳","🤯","🫡","👻","💀","🤡","😈"] },
  { label: "👋", emojis: ["👍","👎","👏","🤝","🙏","💪","✌️","🤞","👋","🫶","❤️","🔥","⭐","💯","✅","❌","⚡","🎉","🎊","💰","📦","🚛","🏗️","⏰"] },
  { label: "🍕", emojis: ["🍕","🍔","🍟","🌮","🍣","🍺","☕","🧃","🍎","🍩","🎂","🍫","🥤","🍷","🥂","🍿","🌭","🥗","🍜","🧁"] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EmojiPicker = memo(({ onSelect }: EmojiPickerProps) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl"
    >
      {/* Category tabs */}
      <div className="flex border-b border-border/30 px-2 pt-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-2 text-lg rounded-t-xl transition-colors ${
              activeTab === i ? "bg-muted/50" : ""
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Emojis grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto scrollbar-hide">
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-muted/50 active:scale-90 transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
});
EmojiPicker.displayName = "EmojiPicker";

export default EmojiPicker;
