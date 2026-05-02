import { memo } from "react";

/**
 * Skeleton bubbles for chat — alternating sides to mimic a real conversation.
 */
const ChatSkeleton = memo(() => {
  const rows = [
    { own: false, w: "65%" },
    { own: true, w: "45%" },
    { own: false, w: "78%" },
    { own: false, w: "55%" },
    { own: true, w: "60%" },
    { own: true, w: "35%" },
    { own: false, w: "70%" },
  ];

  return (
    <div className="px-3 py-4 space-y-2 animate-fade-in">
      {rows.map((r, i) => (
        <div key={i} className={`flex ${r.own ? "justify-end" : "justify-start"}`}>
          <div
            className="h-9 rounded-2xl skeleton-shimmer"
            style={{ width: r.w, maxWidth: "78%" }}
          />
        </div>
      ))}
    </div>
  );
});

ChatSkeleton.displayName = "ChatSkeleton";

export default ChatSkeleton;
