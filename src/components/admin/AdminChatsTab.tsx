import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  is_group: boolean | null;
  participants: string[];
}

interface Message {
  id: string;
  text: string | null;
  sender_id: string;
  created_at: string;
  sender_name?: string;
}

const AdminChatsTab = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    const fetchConvs = async () => {
      setLoading(true);
      const { data: convs } = await supabase.from("conversations").select("*").order("created_at", { ascending: false });
      if (!convs) { setLoading(false); return; }

      const enriched: Conversation[] = [];
      for (const c of convs) {
        const { data: parts } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", c.id);
        const userIds = parts?.map(p => p.user_id) || [];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const names = profiles?.map(p => p.full_name) || [];
        enriched.push({ ...c, participants: names });
      }
      setConversations(enriched);
      setLoading(false);
    };
    fetchConvs();
  }, []);

  const openConversation = async (convId: string) => {
    setSelectedConv(convId);
    setMessagesLoading(true);
    const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
    if (msgs) {
      const senderIds = [...new Set(msgs.map(m => m.sender_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", senderIds);
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      setMessages(msgs.map(m => ({ ...m, sender_name: nameMap.get(m.sender_id) || "—" })));
    }
    setMessagesLoading(false);
  };

  if (selectedConv) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedConv(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Назад к списку
        </Button>
        <ScrollArea className="h-[60vh] border rounded-lg p-4">
          {messagesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Нет сообщений</div>
          ) : (
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{m.sender_name}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd.MM HH:mm")}</span>
                  </div>
                  <p className="text-sm mt-1">{m.text || <span className="text-muted-foreground italic">Медиа</span>}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Нет чатов</div>
      ) : (
        conversations.map(c => (
          <Card key={c.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openConversation(c.id)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.title || "Без названия"}</div>
                <div className="text-xs text-muted-foreground truncate">{c.participants.join(", ")}</div>
              </div>
              <div className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd.MM")}</div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default AdminChatsTab;
