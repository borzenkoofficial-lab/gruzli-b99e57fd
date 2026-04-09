import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, MessageSquare, Briefcase, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminChatsTab from "@/components/admin/AdminChatsTab";
import AdminJobsTab from "@/components/admin/AdminJobsTab";

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
        <Tabs defaultValue="users">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="chats" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Чаты
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Заказы
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <AdminUsersTab />
          </TabsContent>
          <TabsContent value="chats">
            <AdminChatsTab />
          </TabsContent>
          <TabsContent value="jobs">
            <AdminJobsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
