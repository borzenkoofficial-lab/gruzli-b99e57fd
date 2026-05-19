import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import DesktopLayout from "@/components/DesktopLayout";
import DesktopTopBar from "@/components/DesktopTopBar";
import FAB from "@/components/FAB";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScreenSkeleton from "@/components/ScreenSkeleton";
import AnnouncementModal from "@/components/AnnouncementModal";
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
const CompanyScreen = lazy(() => import("@/screens/CompanyScreen"));
const DispatcherCabinetScreen = lazy(() => import("@/screens/DispatcherCabinetScreen"));
const DispatcherCommunityScreen = lazy(() => import("@/screens/DispatcherCommunityScreen"));
const SupportChatScreen = lazy(() => import("@/screens/SupportChatScreen"));
const ContractScreen = lazy(() => import("@/screens/ContractScreen"));
const PullToRefresh = lazy(() => import("@/components/PullToRefresh"));

const Index = () => {
  const { role, user } = useAuth();
  const { unreadMessages, newJobsCount, resetMessages, resetJobs, refetchUnread } = useUnreadCounts();
  const isMobile = useIsMobile();
  const { jobId: routeJobId } = useParams<{ jobId?: string }>();
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const SUPPORT_NAME = "Gruzli Official";

  useEffect(() => {
    // Cache support user id in localStorage to avoid repeat lookups
    const SUPPORT_CACHE_KEY = "gruzli_support_user_id";
    const cached = localStorage.getItem(SUPPORT_CACHE_KEY);
    if (cached) {
      setSupportUserId(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles_public" as any)
        .select("user_id")
        .eq("full_name", "Gruzli Official")
        .limit(1)
        .maybeSingle();

      let id = (data as any)?.user_id ?? null;
      if (!id) {
        const { data: rpcId } = await supabase.rpc("get_support_user_id");
        id = (rpcId as string) ?? null;
      }

      if (!cancelled && id) {
        localStorage.setItem(SUPPORT_CACHE_KEY, id);
        setSupportUserId(id);
      }
    })();

    return () => { cancelled = true; };
  }, []);
  const [tab, setTab] = useState("feed");

  useEffect(() => {
    const handler = () => setTab("feed");
    window.addEventListener("navigate-to-feed", handler);
    return () => window.removeEventListener("navigate-to-feed", handler);
  }, []);

  // Handle deep links: /?openChat=..., /?action=support, /?action=settings
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("openChat");
    const action = params.get("action");
    if (chatId) {
      setTab("chats");
      setOpenChatId(chatId);
      setOpenChatTitle("");
    }
    if (action === "settings") {
      setShowSettings(true);
    }
    if (chatId || action) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Support deep link runs after supportUserId resolves
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "support" && supportUserId && user) {
      handleChatWithUser(supportUserId, SUPPORT_NAME);
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportUserId, user]);

  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [openChatTitle, setOpenChatTitle] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [viewResponsesJob, setViewResponsesJob] = useState<Tables<"jobs"> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showCabinet, setShowCabinet] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [viewJobDetail, setViewJobDetail] = useState<Tables<"jobs"> | null>(null);
  const [viewContractId, setViewContractId] = useState<string | null>(null);

  // Listen for global open-contract event from any screen
  useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.contractId;
      if (id) setViewContractId(id);
    };
    window.addEventListener("open-contract" as any, handler);
    return () => window.removeEventListener("open-contract" as any, handler);
  }, []);

  // Deep-link: open job from /job/:jobId (push notification click)
  useEffect(() => {
    if (!routeJobId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", routeJobId)
        .maybeSingle();
      if (!cancelled && data) {
        setViewJobDetail(data);
      }
      // Clean URL to root
      window.history.replaceState({}, "", "/");
    })();
    return () => { cancelled = true; };
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
    if (!otherUserId) {
      toast.error("Не удалось связаться с поддержкой. Попробуйте позже.");
      return false;
    }

    // Use security-definer function to find or create 1-on-1 conversation
    const { data: conversationId, error } = await supabase.rpc("create_direct_conversation", {
      _other_user_id: otherUserId,
      _title: otherName,
    });

    if (error || !conversationId) {
      toast.error("Не удалось создать чат");
      return false;
    }

    if (prefillMessage) {
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
        return <RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} onOpenProfile={(userId) => { setOpenChatId(null); setViewProfileUserId(userId); }} onMessagesRead={refetchUnread} />;
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
        return <PremiumScreen onBack={() => setShowPremium(false)} onOpenSupport={(msg) => { setShowPremium(false); handleChatWithUser(supportUserId || '', SUPPORT_NAME, msg); }} />;
      }
      if (showCompany) {
        return <CompanyScreen onBack={() => setShowCompany(false)} onOpenSupport={(msg) => { setShowCompany(false); handleChatWithUser(supportUserId || '', SUPPORT_NAME, msg); }} />;
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
            onViewResponses={setViewResponsesJob}
            onCreateJob={() => setShowCreateJob(true)}
          />
        );
      }
      if (showSupportChat) {
        return (
          <SupportChatScreen
            onBack={() => setShowSupportChat(false)}
            onOpenAdminChat={() => {
              setShowSupportChat(false);
              handleChatWithUser(supportUserId || '', SUPPORT_NAME);
            }}
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
      if (viewContractId) {
        return <ContractScreen contractId={viewContractId} onBack={() => setViewContractId(null)} />;
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
    if (showPremium) return wrapSuspense(<PremiumScreen onBack={() => setShowPremium(false)} onOpenSupport={(msg) => { setShowPremium(false); handleChatWithUser(supportUserId || '', SUPPORT_NAME, msg); }} />);
    if (showCompany) return wrapSuspense(<CompanyScreen onBack={() => setShowCompany(false)} onOpenSupport={(msg) => { setShowCompany(false); handleChatWithUser(supportUserId || '', SUPPORT_NAME, msg); }} />);
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
          onViewResponses={setViewResponsesJob}
          onCreateJob={() => setShowCreateJob(true)}
        />
      );
    }
    if (showSupportChat) {
      return wrapSuspense(
        <SupportChatScreen
          onBack={() => setShowSupportChat(false)}
          onOpenAdminChat={() => {
            setShowSupportChat(false);
            handleChatWithUser(supportUserId || '', SUPPORT_NAME);
          }}
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
    if (openChatId) return wrapSuspense(<RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} onOpenProfile={(userId) => { setOpenChatId(null); setViewProfileUserId(userId); }} onMessagesRead={refetchUnread} />);
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
    if (viewContractId) {
      return wrapSuspense(<ContractScreen contractId={viewContractId} onBack={() => setViewContractId(null)} />);
    }

    return (
      <div className="app-shell">
        <ErrorBoundary>
          <Suspense fallback={<ScreenSkeleton />}>
            {tab === "feed" ? (
              <PullToRefresh onRefresh={handlePullRefresh}>
                {isDispatcher ? (
                  <DispatcherCabinetScreen
                    embedded
                    onBack={() => {}}
                    onChatWithWorker={async (workerId, workerName) => { await handleChatWithUser(workerId, workerName); }}
                    onViewProfile={setViewProfileUserId}
                    onOpenCommunity={() => setShowCommunity(true)}
                    onViewResponses={setViewResponsesJob}
                    onRefreshRef={feedRefreshRef}
                    onCreateJob={() => setShowCreateJob(true)}
                  />
                ) : (
                  <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} onOpenJob={setViewJobDetail} onRefreshRef={feedRefreshRef} />
                )}
              </PullToRefresh>
            ) : (
              <div className="app-scroll">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {tab === "orders" && <OrdersScreen />}
                    {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} onOpenCommunity={() => setShowCommunity(true)} />}
                    {tab === "kartoteka" && <KartotekaScreen />}
                    {tab === "dispatchers" && !isDispatcher && <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />}
                    {tab === "profile" && (
                      <ProfileScreen
                        onOpenSettings={() => setShowSettings(true)}
                        onOpenNotifications={() => setShowNotifications(true)}
                        onOpenSupport={(prefillMessage) => handleChatWithUser(supportUserId || '', SUPPORT_NAME, prefillMessage)}
                        onOpenPremium={() => setShowPremium(true)}
                        onOpenCabinet={() => { setShowCabinet(false); handleNavigate("feed"); }}
                        onOpenCompany={() => setShowCompany(true)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
        
        <BottomNav active={tab} onNavigate={handleNavigate} isDispatcher={isDispatcher} unreadMessages={unreadMessages} newJobsCount={newJobsCount} />
        <AnnouncementModal />
      </div>
    );
  }

  // --- Desktop layout ---
  const mainContent = (
    <ErrorBoundary>
      <Suspense fallback={<ScreenSkeleton />}>
        {tab === "feed" && (
          isDispatcher ? (
            <DispatcherCabinetScreen
              embedded
              onBack={() => {}}
              onChatWithWorker={async (workerId, workerName) => { await handleChatWithUser(workerId, workerName); }}
              onViewProfile={setViewProfileUserId}
              onOpenCommunity={() => setShowCommunity(true)}
              onViewResponses={setViewResponsesJob}
              onRefreshRef={feedRefreshRef}
              onCreateJob={() => setShowCreateJob(true)}
            />
          ) : (
            <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} onOpenJob={setViewJobDetail} onRefreshRef={feedRefreshRef} />
          )
        )}
        {tab === "orders" && <OrdersScreen />}
        {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} onOpenCommunity={() => setShowCommunity(true)} />}
        {tab === "kartoteka" && <KartotekaScreen />}
        {tab === "dispatchers" && !isDispatcher && <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />}
        {tab === "profile" && (
          <ProfileScreen
            onOpenSettings={() => setShowSettings(true)}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenSupport={(prefillMessage) => handleChatWithUser(supportUserId || '', SUPPORT_NAME, prefillMessage)}
            onOpenPremium={() => setShowPremium(true)}
            onOpenCabinet={() => { setShowCabinet(false); handleNavigate("feed"); }}
            onOpenCompany={() => setShowCompany(true)}
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
      onCreateJob={() => setShowCreateJob(true)}
      onOpenNotifications={() => setShowNotifications(true)}
      onOpenPremium={() => setShowPremium(true)}
      onOpenSupport={() => handleChatWithUser(supportUserId || '', SUPPORT_NAME)}
      onOpenSettings={() => setShowSettings(true)}
      onOpenCommunity={isDispatcher ? () => setShowCommunity(true) : undefined}
      onOpenProfile={() => handleNavigate("profile")}
    />
  );

  const pageTitleMap: Record<string, { title: string; subtitle?: string }> = {
    feed: isDispatcher
      ? { title: "Мои заявки", subtitle: "Управляйте набором и активными заказами" }
      : { title: "Лента заявок", subtitle: "Свежие заказы от диспетчеров" },
    orders: { title: "Мои заказы", subtitle: "История и активные смены" },
    chats: { title: "Сообщения", subtitle: "Чаты, каналы и сообщество" },
    kartoteka: { title: "Картотека", subtitle: "База контактов и компаний" },
    profile: { title: "Профиль", subtitle: "Личный кабинет и настройки" },
    dispatchers: { title: "Диспетчеры", subtitle: "Найдите диспетчера и свяжитесь с ним" },
  };
  const pageMeta = pageTitleMap[tab] || { title: "Gruzli" };

  const detailPanel = getDetailPanel();

  // Close all overlays/detail at once
  const closeDetail = () => {
    setOpenChatId(null);
    setViewProfileUserId(null);
    setShowSettings(false);
    setShowNotifications(false);
    setShowPremium(false);
    setShowChannel(false);
    setShowCreateJob(false);
    setViewResponsesJob(null);
    setShowCommunity(false);
    setShowCabinet(false);
    setShowSupportChat(false);
    setViewJobDetail(null);
    setViewContractId(null);
  };

  const topBar = (
    <DesktopTopBar
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      unreadNotifications={0}
      onOpenNotifications={() => setShowNotifications(true)}
      onCreateJob={() => setShowCreateJob(true)}
      showCreateJob={isDispatcher}
    />
  );

  return (
    <>
      <DesktopLayout
        sidebar={sidebar}
        topBar={topBar}
        main={mainContent}
        detail={detailPanel}
        onCloseDetail={detailPanel ? closeDetail : undefined}
      />
      <AnnouncementModal />
    </>
  );
};

export default Index;
