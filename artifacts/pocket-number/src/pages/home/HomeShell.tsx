import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useChatLauncher } from "@/contexts/ChatLauncherContext";
import { useLocation } from "wouter";
import { Phone, MessageCircle, Users, Clock, Search, MoreVertical, User, Settings } from "lucide-react";
import { useHeartbeatPing } from "@/hooks/useHeartbeatPing";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ContactsTab from "./ContactsTab";
import CallsTab from "./CallsTab";
import MessagesTab from "./MessagesTab";
import HistoryTab from "./HistoryTab";

type Tab = "calls" | "messages" | "contacts" | "history";

const tabs: { id: Tab; label: string; icon: typeof Phone }[] = [
  { id: "calls", label: "المكالمات", icon: Phone },
  { id: "messages", label: "الرسائل", icon: MessageCircle },
  { id: "contacts", label: "جهات الاتصال", icon: Users },
  { id: "history", label: "السجل", icon: Clock },
];

export default function HomeShell() {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const { user } = useAuth();
  const { pendingTarget, consumePendingTarget } = useChatLauncher();
  const [, setLocation] = useLocation();
  useHeartbeatPing();

  // If another page (contacts/search) requested a chat, switch to the messages tab
  // so MessagesTab can pick up `pendingTarget` and open the conversation.
  useEffect(() => {
    if (pendingTarget) {
      setActiveTab("messages");
    }
  }, [pendingTarget]);

  const renderTab = () => {
    switch (activeTab) {
      case "calls":
        return <CallsTab />;
      case "messages":
        return (
          <MessagesTab initialPeer={pendingTarget} onInitialPeerConsumed={consumePendingTarget} />
        );
      case "contacts":
        return <ContactsTab />;
      case "history":
        return <HistoryTab />;
    }
  };

  return (
    <MobileLayout>
      {/* Top header */}
      <div className="bg-background border-b border-border px-5 py-4 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs text-muted-foreground font-medium">مرحباً،</p>
          <p className="text-base font-bold text-foreground leading-tight">{user?.name ?? "—"}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <button
            onClick={() => setLocation("/search")}
            className="w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label="البحث عن مستخدم"
          >
            <Search className="w-4 h-4 text-secondary-foreground" />
          </button>

          {/* Pocket number badge → profile */}
          <button
            onClick={() => setLocation("/profile")}
            className="flex flex-col items-end gap-0.5"
            aria-label="الملف الشخصي"
          >
            <span className="text-[10px] text-muted-foreground font-medium">رقمك الخاص</span>
            <span
              className="text-sm font-black text-primary tracking-wider font-mono bg-primary/8 px-2.5 py-0.5 rounded-full"
              dir="ltr"
            >
              {user?.pocketNumber ?? "—"}
            </span>
          </button>

          {/* Three-dot menu — secondary navigation */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
                aria-label="المزيد"
              >
                <MoreVertical className="w-4 h-4 text-secondary-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => setLocation("/profile")}>
                <User className="w-4 h-4 ml-2 text-muted-foreground" />
                الملف الشخصي
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                <Settings className="w-4 h-4 ml-2 text-muted-foreground" />
                الإعدادات
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">{renderTab()}</div>

      {/* Bottom tab bar */}
      <div className="shrink-0 bg-background border-t border-border">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("w-5 h-5", isActive && "stroke-[2.5px]")}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                <span className={cn("text-[9px] font-medium", isActive && "font-bold")}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Safe area spacer for mobile */}
        <div className="h-safe-bottom" />
      </div>
    </MobileLayout>
  );
}
