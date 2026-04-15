import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import DesktopLayout from "@/components/DesktopLayout";
import FAB from "@/components/FAB";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScreenSkeleton from "@/components/ScreenSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

// Lazy load all screens
const FeedScreen = lazy(() => import("@/screens/FeedScreen"));
const JobDetailScreen = lazy(() => import("@/screens/JobDetailScreen"));
const OrdersScreen = lazy(() => import("@/screens/OrdersScreen"));
const ProfileScreen = lazy(() => import("@/screens/ProfileScreen"));
const DispatcherFeedScreen = lazy(() => import("@/screens/DispatcherFeedScreen"));
const CreateJobScreen = lazy(() => import("@/screens/CreateJobScreen"));
const JobResponsesScreen = lazy(() => import("@/screens/JobResponsesScreen"));
const RealChatsScreen = lazy(() => import("@/screens/RealChatsScreen"));
const RealChatScreen = lazy(() => import("@/screens/RealChatScreen"));
const ChannelScreen = lazy(() => import("@/screens/ChannelScreen"));
const DispatchersScreen = lazy(() => import("@/screens/DispatchersScreen"));
const KartotekaScreen = lazy(() => import("@/screens/KartotekaScreen"));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen"));
const UserProfileScreen = lazy(() => import("@/screens/UserProfileScreen"));
const NotificationsScreen = lazy(() => import("@/screens/NotificationsScreen"));
const PremiumScreen = lazy(() => import("@/screens/PremiumScreen"));
const DispatcherCabinetScreen = lazy(() => import("@/screens/DispatcherCabinetScreen"));
const DispatcherCommunityScreen = lazy(() => import("@/screens/DispatcherCommunityScreen"));
const PullToRefresh = lazy(() => import("@/components/PullToRefresh"));

const Index = () => {
  const { role, user } = useAuth();
  const { unreadMessages, newJobsCount, resetMessages, resetJobs } = useUnreadCounts();
  const isMobile = useIsMobile();
  const { jobId: routeJobId } = useParams<{ jobId?: string }>();
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const SUPPORT_NAME = "Тех. поддержка";

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", "89066466696")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSupportUserId(data.user_id);
      });
  }, []);
  const [tab, setTab] = useState("feed");

  useEffect(() => {
    const handler = () => setTab("feed");
    window.addEventListener("navigate-to-feed", handler);
    return () => window.removeEventListener("navigate-to-feed", handler);
  }, []);

  // Handle deep link from push notification: /?openChat={conversationId}
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("openChat");
    if (chatId) {
      setTab("chats");
      setOpenChatId(chatId);
      setOpenChatTitle("");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [openChatTitle, setOpenChatTitle] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [viewResponsesJob, setViewResponsesJob] = useState<Tables<"jobs"> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showCabinet, setShowCabinet] = useState(false);
  const [viewJobDetail, setViewJobDetail] = useState<Tables<"jobs"> | null>(null);

  // Deep-link: open job from /job/:jobId (push notification click)
  useEffect(() => {
    if (!routeJobId) return;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", routeJobId)
        .single();
      if (data) {
        setViewJobDetail(data);
      }
      // Clean URL to root
      window.history.replaceState({}, "", "/");
    })();
  }, [routeJobId]);

  const isDispatcher = role === "dispatcher" || role === "admin";
  const feedRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const handlePullRefresh = useCallback(async () => {
    if (feedRefreshRef.current) {
      await feedRefreshRef.current();
    }
  }, []);

  const handleOpenChat = (conversationId: string, title: string) => {
    setOpenChatId(conversationId);
    setOpenChatTitle(title);
  };

  const handleChatWithUser = async (otherUserId: string, otherName: string, prefillMessage?: string) => {
    if (!user) return false;

    const { data: myConvs, error: myConvsError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myConvsError) return false;

    let conversationId: string | null = null;

    if (myConvs) {
      for (const mc of myConvs) {
        const { data: otherParticipant } = await supabase
          .from("conversation_participants")
          .select("id")
          .eq("conversation_id", mc.conversation_id)
          .eq("user_id", otherUserId)
          .single();

        if (otherParticipant) {
          conversationId = mc.conversation_id;
          break;
        }
      }
    }

    if (!conversationId) {
      conversationId = crypto.randomUUID();
      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: conversationId, title: otherName });

      if (convError) return false;

      const { error: participantsError } = await supabase.from("conversation_participants").insert([
        { conversation_id: conversationId, user_id: user.id },
        { conversation_id: conversationId, user_id: otherUserId },
      ]);

      if (participantsError) return false;
    }

    if (prefillMessage && conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        text: prefillMessage,
      });
    }

    handleOpenChat(conversationId, otherName);
    return true;
  };

  const handleNavigate = (t: string) => {
    if (t === "chats") resetMessages();
    if (t === "feed" && !isDispatcher) resetJobs();
    setTab(t);
  };

  // --- Detail panel content for desktop ---
  const getDetailPanel = () => {
    const panel = (() => {
      if (openChatId) {
        return <RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} onOpenProfile={(userId) => { setOpenChatId(null); setViewProfileUserId(userId); }} />;
      }
      if (viewProfileUserId) {
        return (
          <UserProfileScreen
            userId={viewProfileUserId}
            onBack={() => setViewProfileUserId(null)}
            onChat={async (userId, name) => {
              const opened = await handleChatWithUser(userId, name);
              if (opened) setViewProfileUserId(null);
            }}
          />
        );
      }
      if (showSettings) {
        return <SettingsScreen onBack={() => setShowSettings(false)} onOpenPremium={() => { setShowSettings(false); setShowPremium(true); }} />;
      }
      if (showNotifications) {
        return <NotificationsScreen onBack={() => setShowNotifications(false)} />;
      }
      if (showPremium) {
        return <PremiumScreen onBack={() => setShowPremium(false)} onOpenSupport={(msg) => { setShowPremium(false); handleChatWithUser(supportUserId, SUPPORT_NAME, msg); }} />;
      }
      if (showChannel) {
        return <ChannelScreen onBack={() => setShowChannel(false)} />;
      }
      if (showCreateJob) {
        return <CreateJobScreen onBack={() => setShowCreateJob(false)} onCreated={() => { setShowCreateJob(false); setTab("feed"); }} />;
      }
      if (viewResponsesJob) {
        return (
          <JobResponsesScreen
            job={viewResponsesJob}
            onBack={() => setViewResponsesJob(null)}
            onChatWithWorker={async (workerId, workerName) => {
              const opened = await handleChatWithUser(workerId, workerName);
              if (opened) setViewResponsesJob(null);
            }}
          />
        );
      }
      if (showCommunity) {
        return (
          <DispatcherCommunityScreen
            onBack={() => setShowCommunity(false)}
            onOpenProfile={(userId) => { setShowCommunity(false); setViewProfileUserId(userId); }}
          />
        );
      }
      if (showCabinet) {
        return (
          <DispatcherCabinetScreen
            onBack={() => setShowCabinet(false)}
            onChatWithWorker={async (workerId, workerName) => {
              const opened = await handleChatWithUser(workerId, workerName);
              if (opened) setShowCabinet(false);
            }}
            onViewProfile={(userId) => { setShowCabinet(false); setViewProfileUserId(userId); }}
            onOpenCommunity={() => { setShowCabinet(false); setShowCommunity(true); }}
          />
        );
      }
      if (viewJobDetail) {
        return (
          <JobDetailScreen
            job={viewJobDetail}
            onBack={() => setViewJobDetail(null)}
            onOpenChat={handleOpenChat}
            onOpenProfile={(userId) => { setViewJobDetail(null); setViewProfileUserId(userId); }}
          />
        );
      }
      return null;
    })();
    if (!panel) return null;
    return (
      <ErrorBoundary>
        <Suspense fallback={<ScreenSkeleton />}>{panel}</Suspense>
      </ErrorBoundary>
    );
  };

  // --- Mobile: full-screen overlays ---
  if (isMobile) {
    const wrapSuspense = (node: React.ReactNode) => (
      <ErrorBoundary>
        <Suspense fallback={<ScreenSkeleton />}>{node}</Suspense>
      </ErrorBoundary>
    );

    if (showNotifications) return wrapSuspense(<NotificationsScreen onBack={() => setShowNotifications(false)} />);
    if (showPremium) return wrapSuspense(<PremiumScreen onBack={() => setShowPremium(false)} onOpenSupport={(msg) => { setShowPremium(false); handleChatWithUser(supportUserId, SUPPORT_NAME, msg); }} />);
    if (showChannel) return wrapSuspense(<ChannelScreen onBack={() => setShowChannel(false)} />);
    if (showSettings) return wrapSuspense(<SettingsScreen onBack={() => setShowSettings(false)} onOpenPremium={() => { setShowSettings(false); setShowPremium(true); }} />);
    if (showCommunity) {
      return wrapSuspense(
        <DispatcherCommunityScreen
          onBack={() => setShowCommunity(false)}
          onOpenProfile={(userId) => { setShowCommunity(false); setViewProfileUserId(userId); }}
        />
      );
    }
    if (showCabinet) {
      return wrapSuspense(
        <DispatcherCabinetScreen
          onBack={() => setShowCabinet(false)}
          onChatWithWorker={async (workerId, workerName) => {
            const opened = await handleChatWithUser(workerId, workerName);
            if (opened) setShowCabinet(false);
          }}
          onViewProfile={(userId) => { setShowCabinet(false); setViewProfileUserId(userId); }}
          onOpenCommunity={() => { setShowCabinet(false); setShowCommunity(true); }}
        />
      );
    }
    if (viewProfileUserId) {
      return wrapSuspense(
        <UserProfileScreen
          userId={viewProfileUserId}
          onBack={() => setViewProfileUserId(null)}
          onChat={async (userId, name) => {
            const opened = await handleChatWithUser(userId, name);
            if (opened) setViewProfileUserId(null);
          }}
        />
      );
    }
    if (openChatId) return wrapSuspense(<RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} onOpenProfile={(userId) => { setOpenChatId(null); setViewProfileUserId(userId); }} />);
    if (showCreateJob) return wrapSuspense(<CreateJobScreen onBack={() => setShowCreateJob(false)} onCreated={() => { setShowCreateJob(false); setTab("feed"); }} />);
    if (viewResponsesJob) {
      return wrapSuspense(
        <JobResponsesScreen
          job={viewResponsesJob}
          onBack={() => setViewResponsesJob(null)}
          onChatWithWorker={async (workerId, workerName) => {
            const opened = await handleChatWithUser(workerId, workerName);
            if (opened) setViewResponsesJob(null);
          }}
        />
      );
    }
    if (viewJobDetail) {
      return wrapSuspense(
        <JobDetailScreen
          job={viewJobDetail}
          onBack={() => setViewJobDetail(null)}
          onOpenChat={handleOpenChat}
          onOpenProfile={(userId) => { setViewJobDetail(null); setViewProfileUserId(userId); }}
        />
      );
    }

    return (
      <div className="app-shell">
        <ErrorBoundary>
          <Suspense fallback={<ScreenSkeleton />}>
            {tab === "feed" ? (
              <PullToRefresh onRefresh={handlePullRefresh}>
                {isDispatcher ? (
                  <DispatcherFeedScreen onCreateJob={() => setShowCreateJob(true)} onViewResponses={setViewResponsesJob} onRefreshRef={feedRefreshRef} />
                ) : (
                  <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} onOpenJob={setViewJobDetail} onRefreshRef={feedRefreshRef} />
                )}
              </PullToRefresh>
            ) : (
              <div className="app-scroll">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {tab === "orders" && <OrdersScreen />}
                    {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} />}
                    {tab === "kartoteka" && <KartotekaScreen />}
                    {tab === "dispatchers" && !isDispatcher && <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />}
                    {tab === "profile" && (
                      <ProfileScreen
                        onOpenSettings={() => setShowSettings(true)}
                        onOpenNotifications={() => setShowNotifications(true)}
                        onOpenSupport={(prefillMessage) => handleChatWithUser(supportUserId, SUPPORT_NAME, prefillMessage)}
                        onOpenPremium={() => setShowPremium(true)}
                        onOpenCabinet={() => setShowCabinet(true)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
        {!isDispatcher && <FAB />}
        <BottomNav active={tab} onNavigate={handleNavigate} isDispatcher={isDispatcher} unreadMessages={unreadMessages} newJobsCount={newJobsCount} />
      </div>
    );
  }

  // --- Desktop layout ---
  const mainContent = (
    <ErrorBoundary>
      <Suspense fallback={<ScreenSkeleton />}>
        {tab === "feed" && (
          isDispatcher ? (
            <DispatcherFeedScreen onCreateJob={() => setShowCreateJob(true)} onViewResponses={setViewResponsesJob} onRefreshRef={feedRefreshRef} />
          ) : (
            <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} onOpenJob={setViewJobDetail} onRefreshRef={feedRefreshRef} />
          )
        )}
        {tab === "orders" && <OrdersScreen />}
        {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} />}
        {tab === "kartoteka" && <KartotekaScreen />}
        {tab === "dispatchers" && !isDispatcher && <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />}
        {tab === "profile" && (
          <ProfileScreen
            onOpenSettings={() => setShowSettings(true)}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenSupport={(prefillMessage) => handleChatWithUser(supportUserId, SUPPORT_NAME, prefillMessage)}
            onOpenPremium={() => setShowPremium(true)}
            onOpenCabinet={() => setShowCabinet(true)}
          />
        )}
      </Suspense>
    </ErrorBoundary>
  );

  const sidebar = (
    <DesktopSidebar
      active={tab}
      onNavigate={handleNavigate}
      isDispatcher={isDispatcher}
      unreadMessages={unreadMessages}
      newJobsCount={newJobsCount}
    />
  );

  return (
    <DesktopLayout
      sidebar={sidebar}
      main={mainContent}
      detail={getDetailPanel()}
    />
  );
};

export default Index;
