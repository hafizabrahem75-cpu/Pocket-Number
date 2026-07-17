import { useState } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useLogout, useGetMe, useChangePassword, useDeleteMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  ChevronLeft,
  LogOut,
  Loader2,
  Code2,
  Phone,
  MessageCircle,
  MessageSquareText,
  X,
  Languages,
  Moon,
  Info,
  Smartphone,
  Lock,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Kept out of the DOM/UI on purpose — never rendered, only used to build the
// tel:/wa.me/sms: links below.
const DEVELOPER_PHONE = "+967717245252";

type Copy = {
  title: string;
  profile: string;
  developerInfo: string;
  developerName: string;
  developerHint: string;
  appSettings: string;
  aboutApp: string;
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
  pocketNumber: string;
  email: string;
  name: string;
  account: string;
  changePassword: string;
  changePasswordHint: string;
  deleteAccount: string;
  deleteAccountHint: string;
};

const copy: Record<"ar" | "en", Copy> = {
  ar: {
    title: "الإعدادات",
    profile: "الحساب",
    developerInfo: "المطور",
    developerName: "حافظ السراء",
    developerHint: "اضغط للتواصل",
    appSettings: "إعدادات التطبيق",
    aboutApp: "حول التطبيق",
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
    pocketNumber: "رقم الجيب",
    email: "البريد الإلكتروني",
    name: "الاسم",
    account: "إدارة الحساب",
    changePassword: "تغيير كلمة المرور",
    changePasswordHint: "تحديث كلمة المرور الحالية",
    deleteAccount: "حذف الحساب",
    deleteAccountHint: "إزالة حسابك نهائياً",
  },
  en: {
    title: "Settings",
    profile: "Account",
    developerInfo: "Developer",
    developerName: "حافظ السراء",
    developerHint: "Tap to contact",
    appSettings: "App Settings",
    aboutApp: "About",
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
    pocketNumber: "Pocket Number",
    email: "Email",
    name: "Name",
    account: "Account Management",
    changePassword: "Change Password",
    changePasswordHint: "Update your current password",
    deleteAccount: "Delete Account",
    deleteAccountHint: "Permanently remove your account",
  },
} as const;

// ── Developer contact sheet ──────────────────────────────────────────────────

function DeveloperContactSheet({ onClose, t }: { onClose: () => void; t: Copy }) {
  const waNumber = DEVELOPER_PHONE.replace(/[^\d]/g, "");
  const actions = [
    { label: t.call, icon: Phone, href: `tel:${DEVELOPER_PHONE}` },
    { label: t.whatsapp, icon: MessageCircle, href: `https://wa.me/${waNumber}` },
    { label: t.sms, icon: MessageSquareText, href: `sms:${DEVELOPER_PHONE}` },
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

// ── Change-password sheet ────────────────────────────────────────────────────

function ChangePasswordSheet({ onClose, language }: { onClose: () => void; language: "ar" | "en" }) {
  const { toast } = useToast();
  const changePasswordMutation = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isAr = language === "ar";

  const handleSubmit = () => {
    if (!current || !next || !confirm) {
      toast({ title: isAr ? "يرجى ملء جميع الحقول" : "Please fill all fields", variant: "destructive" });
      return;
    }
    if (next.length < 8) {
      toast({ title: isAr ? "كلمة المرور الجديدة قصيرة جداً" : "New password too short", description: isAr ? "8 أحرف على الأقل" : "At least 8 characters", variant: "destructive" });
      return;
    }
    if (next !== confirm) {
      toast({ title: isAr ? "كلمتا المرور غير متطابقتين" : "Passwords don't match", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate(
      { data: { currentPassword: current, newPassword: next } },
      {
        onSuccess: () => {
          toast({ title: isAr ? "تم تغيير كلمة المرور" : "Password changed" });
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { error?: string })?.error ?? (isAr ? "فشل تغيير كلمة المرور" : "Failed to change password");
          toast({ title: isAr ? "خطأ" : "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-[400px] bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-bold text-base">{isAr ? "تغيير كلمة المرور" : "Change Password"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={isAr ? "إغلاق" : "Close"}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Current password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {isAr ? "كلمة المرور الحالية" : "Current password"}
            </label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                dir="ltr"
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {isAr ? "كلمة المرور الجديدة" : "New password"}
            </label>
            <div className="relative">
              <Input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                dir="ltr"
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNext((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{isAr ? "8 أحرف على الأقل" : "At least 8 characters"}</p>
          </div>

          {/* Confirm new password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm new password"}
            </label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                dir="ltr"
                className="pr-10"
                autoComplete="new-password"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={changePasswordMutation.isPending}
        >
          {changePasswordMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
          ) : null}
          {isAr ? "حفظ كلمة المرور" : "Save password"}
        </Button>
      </div>
    </div>
  );
}

// ── Delete-account sheet ─────────────────────────────────────────────────────

function DeleteAccountSheet({ onClose, language }: { onClose: () => void; language: "ar" | "en" }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const deleteMeMutation = useDeleteMe();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const isAr = language === "ar";

  const handleDelete = () => {
    if (!password) {
      toast({ title: isAr ? "يرجى إدخال كلمة المرور" : "Please enter your password", variant: "destructive" });
      return;
    }
    deleteMeMutation.mutate(
      { data: { password } },
      {
        onSuccess: () => {
          queryClient.clear();
          logout();
        },
        onError: (err: unknown) => {
          const msg = (err as { error?: string })?.error ?? (isAr ? "فشل حذف الحساب" : "Failed to delete account");
          toast({ title: isAr ? "خطأ" : "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-[400px] bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-bold text-base text-destructive">{isAr ? "حذف الحساب" : "Delete Account"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={isAr ? "إغلاق" : "Close"}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {!confirmed ? (
          /* Step 1 — warning */
          <div className="space-y-5">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 space-y-2">
              <p className="font-bold text-destructive text-sm">
                {isAr ? "تحذير: هذا الإجراء لا يمكن التراجع عنه" : "Warning: This action cannot be undone"}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                {isAr ? (
                  <>
                    <li>سيتم حذف حسابك وجميع بياناتك نهائياً</li>
                    <li>ستُحذف جميع رسائلك وجهات اتصالك</li>
                    <li>لن تتمكن من استرداد رقم الجيب الخاص بك</li>
                  </>
                ) : (
                  <>
                    <li>Your account and all data will be permanently deleted</li>
                    <li>All messages and contacts will be removed</li>
                    <li>Your pocket number cannot be recovered</li>
                  </>
                )}
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setConfirmed(true)}>
                {isAr ? "أفهم، المتابعة" : "I understand, continue"}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2 — password confirmation */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isAr ? "أدخل كلمة مرورك لتأكيد حذف الحساب" : "Enter your password to confirm account deletion"}
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {isAr ? "كلمة المرور" : "Password"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="pr-10"
                  autoFocus
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleDelete()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmed(false)} disabled={deleteMeMutation.isPending}>
                {isAr ? "رجوع" : "Back"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={deleteMeMutation.isPending}
              >
                {deleteMeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : null}
                {isAr ? "حذف حسابي" : "Delete my account"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Settings page ───────────────────────────────────────────────────────

export default function Settings() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const { theme, language, setTheme, setLanguage } = useAppSettings();
  const [showDeveloperContact, setShowDeveloperContact] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const { data: me } = useGetMe();

  const t = copy[language];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        logout();
        toast({
          title: language === "ar" ? "تم تسجيل الخروج" : "Logged out",
          description: language === "ar" ? "نراك قريباً" : "See you soon",
        });
      },
    });
  };

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-background">
        {/* Header */}
        <header className="px-6 pt-12 pb-4 bg-background border-b sticky top-0 z-10 flex items-center shadow-sm">
          <Link href="/home" className="ml-4 text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex-1">{t.title}</h1>
        </header>

        <div className="p-6 space-y-6">

          {/* Account / Profile summary */}
          {me && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                {t.profile}
              </p>
              <div className="bg-background rounded-2xl shadow-sm border overflow-hidden">
                {/* Avatar + name row */}
                <div className="p-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-black text-xl flex items-center justify-center shrink-0">
                    {me.name.trim()[0]?.toUpperCase() ?? "؟"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight truncate">{me.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">
                      {me.email}
                    </p>
                  </div>
                  <Link href="/profile">
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </div>

                {/* Pocket number */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t.pocketNumber}</div>
                    <div className="font-bold font-mono tracking-wider text-sm" dir="ltr">
                      {me.pocketNumber}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account management */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {t.account}
            </p>
            <div className="bg-background rounded-2xl shadow-sm border overflow-hidden">
              {/* Change password */}
              <button
                className="w-full p-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-right"
                onClick={() => setShowChangePassword(true)}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{t.changePassword}</div>
                  <div className="text-xs text-muted-foreground">{t.changePasswordHint}</div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>

              {/* Delete account */}
              <button
                className="w-full p-4 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-right"
                onClick={() => setShowDeleteAccount(true)}
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-destructive">{t.deleteAccount}</div>
                  <div className="text-xs text-muted-foreground">{t.deleteAccountHint}</div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            </div>
          </div>

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

          {/* About */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {t.aboutApp}
            </p>
            <div className="bg-background rounded-2xl shadow-sm border overflow-hidden">
              {/* Version */}
              <div className="p-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-bold">Pocket Number</div>
                  <div className="text-xs text-muted-foreground">{t.version}</div>
                </div>
              </div>

              {/* Developer */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
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
          </div>

          {/* Logout */}
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
        </div>
      </div>

      {showDeveloperContact && (
        <DeveloperContactSheet onClose={() => setShowDeveloperContact(false)} t={t} />
      )}
      {showChangePassword && (
        <ChangePasswordSheet onClose={() => setShowChangePassword(false)} language={language} />
      )}
      {showDeleteAccount && (
        <DeleteAccountSheet onClose={() => setShowDeleteAccount(false)} language={language} />
      )}
    </MobileLayout>
  );
}
