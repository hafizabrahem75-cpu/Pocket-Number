import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import {
  Settings,
  Copy,
  CheckCircle2,
  User as UserIcon,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Wifi,
  WifiOff,
  Pencil,
  Check,
  X,
  Share2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { formatLastSeen } from "@/lib/formatLastSeen";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user: initialUser, login, token } = useAuth();
  const { data: user, isLoading } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const displayUser = user || initialUser;
  const [copied, setCopied] = useState(false);

  // Edit-name state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const updateMeMutation = useUpdateMe();

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copied]);

  const copyNumber = () => {
    if (displayUser?.pocketNumber) {
      navigator.clipboard.writeText(displayUser.pocketNumber);
      setCopied(true);
    }
  };

  const shareNumber = async () => {
    if (!displayUser?.pocketNumber) return;
    const text = `تواصل معي عبر Pocket Number\n\nPocket Number:\n${displayUser.pocketNumber}\n\nحمّل التطبيق وأضفني باستخدام هذا الرقم.`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled — do nothing
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم النسخ", description: "تم نسخ رقمك مع نص المشاركة إلى الحافظة" });
    }
  };

  const startEditing = () => {
    setNameValue(displayUser?.name ?? "");
    setEditingName(true);
  };

  const cancelEditing = () => {
    setEditingName(false);
    setNameValue("");
  };

  const saveName = () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed.length < 2) {
      toast({ title: "الاسم قصير جداً", description: "يجب أن يتكون الاسم من حرفين على الأقل", variant: "destructive" });
      return;
    }
    updateMeMutation.mutate(
      { data: { name: trimmed } },
      {
        onSuccess: (updated) => {
          // Refresh server query cache
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          // Keep localStorage user in sync so header greeting updates immediately
          if (token) login(token, updated);
          setEditingName(false);
          toast({ title: "تم تحديث الاسم" });
        },
        onError: (err: unknown) => {
          const msg = (err as { error?: string })?.error ?? "فشل تحديث الاسم";
          toast({ title: "خطأ", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-background">
        {/* Header */}
        <header className="px-6 pt-12 pb-4 bg-background border-b sticky top-0 z-10 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-bold">الملف الشخصي</h1>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 hover:bg-secondary">
              <Settings className="w-5 h-5 text-secondary-foreground" />
            </Button>
          </Link>
        </header>

        {isLoading && !displayUser ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !displayUser ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            لا يمكن تحميل بيانات المستخدم
          </div>
        ) : (
          <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Number Card */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-primary-foreground shadow-xl shadow-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl transform -translate-x-1/2 translate-y-1/2" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-primary-foreground/80">
                  <Smartphone className="w-5 h-5" />
                  <span className="font-medium text-sm">رقمك الافتراضي</span>
                </div>
                <div className="flex items-end justify-between">
                  <div
                    className="text-4xl font-black tracking-wider drop-shadow-sm flex items-center gap-1"
                    dir="ltr"
                  >
                    {displayUser.pocketNumber || "—"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyNumber}
                    className="text-primary-foreground hover:bg-white/20 hover:text-white rounded-full transition-all active:scale-95"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-6 h-6 text-green-300" />
                    ) : (
                      <Copy className="w-6 h-6" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Share */}
            <Button
              variant="outline"
              className="w-full gap-2 border-2 text-base font-semibold"
              onClick={shareNumber}
              disabled={!displayUser.pocketNumber}
            >
              <Share2 className="w-5 h-5" />
              مشاركة رقمي
            </Button>

            {/* User Details */}
            <div className="bg-background rounded-3xl p-1 shadow-sm border">
              {/* Name — editable */}
              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">الاسم الكامل</p>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName();
                          if (e.key === "Escape") cancelEditing();
                        }}
                        className="h-8 text-base font-bold px-2"
                        autoFocus
                        maxLength={50}
                        dir="auto"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
                        onClick={saveName}
                        disabled={updateMeMutation.isPending}
                      >
                        {updateMeMutation.isPending ? (
                          <span className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={cancelEditing}
                        disabled={updateMeMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg leading-none">{displayUser.name}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={startEditing}
                        aria-label="تعديل الاسم"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">البريد الإلكتروني</p>
                  <p className="font-bold text-base leading-none break-all" dir="ltr">
                    {displayUser.email}
                  </p>
                </div>
              </div>

              {/* Online Status */}
              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    displayUser.isOnline
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                  )}
                >
                  {displayUser.isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">الحالة</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        displayUser.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-400",
                      )}
                    />
                    <p
                      className={cn(
                        "font-bold text-base leading-none",
                        displayUser.isOnline
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-500 dark:text-gray-400",
                      )}
                    >
                      {displayUser.isOnline
                        ? "متصل الآن"
                        : formatLastSeen(displayUser.lastSeenAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verified */}
              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    displayUser.isVerified
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                      : "bg-red-100 text-red-600 dark:bg-red-900/30",
                  )}
                >
                  {displayUser.isVerified ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : (
                    <ShieldAlert className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">حالة الحساب</p>
                  <p
                    className={cn(
                      "font-bold text-base leading-none",
                      displayUser.isVerified
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {displayUser.isVerified ? "موثق" : "غير موثق"}
                  </p>
                </div>
              </div>

              {/* Joined */}
              <div className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">تاريخ الانضمام</p>
                  <p className="font-bold text-base leading-none">
                    {formatDate(displayUser.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
