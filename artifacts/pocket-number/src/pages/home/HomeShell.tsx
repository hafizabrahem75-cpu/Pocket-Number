import { useState } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Phone, MessageCircle, Users, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import ContactsTab from "./ContactsTab";
import CallsTab from "./CallsTab";
import MessagesTab from "./MessagesTab";
import HistoryTab from "./HistoryTab";
import SettingsTab from "./SettingsTab";

type Tab = "calls" | "messages" | "contacts" | "history" | "settings";

const tabs: { id: Tab; label: string; icon: typeof Phone }[] = [
  { id: "calls", label: "المكالمات", icon: Phone },
  { id: "messages", label: "الرسائل", icon: MessageCircle },
  { id: "contacts", label: "جهات الاتصال", icon: Users },
  { id: "history", label: "السجل", icon: Clock },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

export default function HomeShell() {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const renderTab = () => {
    switch (activeTab) {
      case "calls":
        return <CallsTab />;
      case "messages":
        return <MessagesTab />;
      case "contacts":
        return <ContactsTab />;
      case "history":
        return <HistoryTab />;
      case "settings":
        return <SettingsTab />;
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
