import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, MessageSquare, Briefcase, ShieldCheck, Settings, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminDashboardTab from "@/components/admin/AdminDashboardTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminChatsTab from "@/components/admin/AdminChatsTab";
import AdminJobsTab from "@/components/admin/AdminJobsTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";

const AdminPage = () => {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [role, loading, navigate]);

  if (loading || role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Админ-панель</h1>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="dashboard" className="gap-1 text-xs px-1">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Дашборд</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-xs px-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Юзеры</span>
            </TabsTrigger>
            <TabsTrigger value="chats" className="gap-1 text-xs px-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Чаты</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1 text-xs px-1">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Заказы</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs px-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboardTab />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsersTab />
          </TabsContent>
          <TabsContent value="chats">
            <AdminChatsTab />
          </TabsContent>
          <TabsContent value="jobs">
            <AdminJobsTab />
          </TabsContent>
          <TabsContent value="settings">
            <AdminSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
