import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import FAB from "@/components/FAB";
import FeedScreen from "@/screens/FeedScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import ChatDetailScreen from "@/screens/ChatDetailScreen";
import OrdersScreen from "@/screens/OrdersScreen";
import DispatchersScreen from "@/screens/DispatchersScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import JobDetailScreen from "@/screens/JobDetailScreen";
import type { Job, ChatPreview } from "@/data/mockData";

const Index = () => {
  const [tab, setTab] = useState("feed");
  const [openChat, setOpenChat] = useState<ChatPreview | null>(null);
  const [openJob, setOpenJob] = useState<Job | null>(null);

  const handleChatDispatcher = (d: { name: string; avatar: string; id: string }) => {
    setOpenChat({
      id: d.id,
      name: d.name,
      avatar: d.avatar,
      lastMessage: "",
      time: "",
      unread: 0,
      online: true,
    });
  };

  if (openChat) {
    return <ChatDetailScreen chat={openChat} onBack={() => setOpenChat(null)} />;
  }

  if (openJob) {
    return <JobDetailScreen job={openJob} onBack={() => setOpenJob(null)} />;
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "feed" && <FeedScreen onOpenJob={setOpenJob} />}
          {tab === "chats" && <ChatsScreen onOpenChat={setOpenChat} />}
          {tab === "orders" && <OrdersScreen />}
          {tab === "dispatchers" && <DispatchersScreen onChatWithDispatcher={handleChatDispatcher} />}
          {tab === "profile" && <ProfileScreen />}
        </motion.div>
      </AnimatePresence>
      <FAB />
      <BottomNav active={tab} onNavigate={setTab} />
    </div>
  );
};

export default Index;
