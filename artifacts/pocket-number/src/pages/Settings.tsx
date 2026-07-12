import { useState } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useLogout } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  ArrowRight,
  LogOut,
  Loader2,
  Code2,
  Phone,
  MessageCircle,
  MessageSquareText,
  X,
  Languages,
  Moon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Kept out of the DOM/UI on purpose — never rendered, only used to build the
// tel:/wa.me/sms: links below.
const DEVELOPER_PHONE = "+967717245252";

type Copy = {
  title: string;
  developerInfo: string;
  developerName: string;
  developerHint: string;
  appSettings: string;
  language: string;
  languageValue: string;
  theme: string;
  themeHint: string;
  logout: string;
  version: string;
  call: string;
  whatsapp: string;
  sms: string;
  close: string;
  contactTitle: string;
};

const copy: Record<"ar" | "en", Copy> = {
  ar: {
    title: "الإعدادات",
    developerInfo: "معلومات المطور",
    developerName: "حافظ السراء",
    developerHint: "اضغط للتواصل",
    appSettings: "إعدادات التطبيق",
    language: "اللغة",
    languageValue: "العربية",
    theme: "المظهر الليلي",
    themeHint: "الوضع الداكن",
    logout: "تسجيل الخروج",
    version: "الإصدار 1.0.0",
    call: "مكالمة",
    whatsapp: "واتساب",
    sms: "رسالة نصية",
    close: "إغلاق",
    contactTitle: "التواصل مع المطور",
  },
  en: {
    title: "Settings",
    developerInfo: "Developer Info",
    developerName: "حافظ السراء",
    developerHint: "Tap to contact",
    appSettings: "App Settings",
    language: "Language",
    languageValue: "English",
    theme: "Dark Mode",
    themeHint: "Dark appearance",
    logout: "Log Out",
    version: "Version 1.0.0",
    call: "Call",
    whatsapp: "WhatsApp",
    sms: "SMS",
    close: "Close",
    contactTitle: "Contact Developer",
  },
} as const;

function DeveloperContactSheet({ onClose, t }: { onClose: () => void; t: Copy }) {
  const waNumber = DEVELOPER_PHONE.replace(/[^\d]/g, "");
  const actions = [
    {
      label: t.call,
      icon: Phone,
      href: `tel:${DEVELOPER_PHONE}`,
    },
    {
      label: t.whatsapp,
      icon: MessageCircle,
      href: `https://wa.me/${waNumber}`,
    },
    {
      label: t.sms,
      icon: MessageSquareText,
      href: `sms:${DEVELOPER_PHONE}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-[340px] bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-bold text-base">{t.contactTitle}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={t.close}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {actions.map(({ label, icon: Icon, href }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-semibold">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const { theme, language, setTheme, setLanguage } = useAppSettings();
  const [showDeveloperContact, setShowDeveloperContact] = useState(false);

  const t = copy[language];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout(); // Logout from context which redirects to /login
        toast({
          title: language === "ar" ? "تم تسجيل الخروج" : "Logged out",
          description: language === "ar" ? "نراك قريباً" : "See you soon",
        });
      }
    });
  };

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-background">
        <header className="px-6 pt-12 pb-4 bg-background border-b sticky top-0 z-10 flex items-center shadow-sm">
          <Link href="/profile" className="mr-4 text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex-1">{t.title}</h1>
        </header>

        <div className="p-6 space-y-6">
          {/* App Settings */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {t.appSettings}
            </p>
            <div className="bg-background rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <Languages className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-bold">{t.language}</div>
                    <div className="text-xs text-muted-foreground">{t.languageValue}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={language === "ar" ? "text-primary" : "text-muted-foreground"}>ع</span>
                  <Switch
                    checked={language === "en"}
                    onCheckedChange={(checked) => setLanguage(checked ? "en" : "ar")}
                  />
                  <span className={language === "en" ? "text-primary" : "text-muted-foreground"}>EN</span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-bold">{t.theme}</div>
                    <div className="text-xs text-muted-foreground">{t.themeHint}</div>
                  </div>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </div>
          </div>

          {/* Developer Info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {t.developerInfo}
            </p>
            <div
              className="bg-background rounded-2xl shadow-sm border overflow-hidden p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              onClick={() => setShowDeveloperContact(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold">{t.developerName}</div>
                  <div className="text-xs text-muted-foreground">{t.developerHint}</div>
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <Button 
            variant="destructive" 
            size="lg" 
            className="w-full text-lg shadow-sm" 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <LogOut className="w-5 h-5 ml-2" />
                {t.logout}
              </>
            )}
          </Button>
          
          <p className="text-center text-sm text-muted-foreground pt-8">
            {t.version}
          </p>
        </div>
      </div>

      {showDeveloperContact && (
        <DeveloperContactSheet onClose={() => setShowDeveloperContact(false)} t={t} />
      )}
    </MobileLayout>
  );
}
