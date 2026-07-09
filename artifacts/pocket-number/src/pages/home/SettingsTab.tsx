import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { LogOut, User, ChevronLeft, Shield, Bell, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function SettingsRow({
  icon: Icon,
  label,
  sublabel,
  onClick,
  destructive = false,
  loading = false,
}: {
  icon: typeof LogOut;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-4 bg-background hover:bg-muted/40 transition-colors active:bg-muted/60 border-b border-border last:border-0 disabled:opacity-60",
        destructive && "text-rose-500",
      )}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", destructive ? "bg-rose-50" : "bg-muted")}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Icon className={cn("w-4 h-4", destructive ? "text-rose-500" : "text-muted-foreground")} />
        )}
      </div>
      <div className="flex-1 text-right">
        <p className={cn("text-sm font-semibold", destructive ? "text-rose-500" : "text-foreground")}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {!destructive && <ChevronLeft className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

export default function SettingsTab() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const handleProfile = () => setLocation("/profile");

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout();
        toast({ title: "تم تسجيل الخروج", description: "نراك قريباً" });
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Account card */}
      <div className="p-4 pb-0">
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 mb-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black">
            {user?.name?.trim()[0]?.toUpperCase() ?? "؟"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate">{user?.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <p className="text-xs font-mono font-bold text-primary mt-0.5" dir="ltr">{user?.pocketNumber}</p>
          </div>
        </div>
      </div>

      {/* Settings items */}
      <div className="mx-4 rounded-2xl border border-border overflow-hidden">
        <SettingsRow
          icon={User}
          label="الملف الشخصي"
          sublabel="عرض بياناتك الكاملة"
          onClick={handleProfile}
        />
        <SettingsRow
          icon={Bell}
          label="الإشعارات"
          sublabel="قريباً"
        />
        <SettingsRow
          icon={Shield}
          label="الأمان والخصوصية"
          sublabel="قريباً"
        />
      </div>

      <div className="mx-4 mt-3 rounded-2xl border border-rose-100 overflow-hidden">
        <SettingsRow
          icon={LogOut}
          label="تسجيل الخروج"
          onClick={handleLogout}
          destructive
          loading={logoutMutation.isPending}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6 pb-4">
        Pocket Number · المرحلة الثانية
      </p>
    </div>
  );
}
