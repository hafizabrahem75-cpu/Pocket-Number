import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGetMe } from "@workspace/api-client-react";
import { Settings, Copy, CheckCircle2, User as UserIcon, Calendar, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";

export default function Profile() {
  const { user: initialUser } = useAuth();
  const { data: user, isLoading } = useGetMe();

  const displayUser = user || initialUser;
  const [copied, setCopied] = useState(false);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !displayUser ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            لا يمكن تحميل بيانات المستخدم
          </div>
        ) : (
          <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Number Card */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-primary-foreground shadow-xl shadow-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl transform -translate-x-1/2 translate-y-1/2"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-primary-foreground/80">
                  <Smartphone className="w-5 h-5" />
                  <span className="font-medium text-sm">رقمك الافتراضي</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-4xl font-black tracking-wider drop-shadow-sm flex items-center gap-1" dir="ltr">
                    {displayUser.pocketNumber || 'PN-000000'}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={copyNumber}
                    className="text-primary-foreground hover:bg-white/20 hover:text-white rounded-full transition-all active:scale-95"
                  >
                    {copied ? <CheckCircle2 className="w-6 h-6 text-green-300" /> : <Copy className="w-6 h-6" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* User Details */}
            <div className="bg-background rounded-3xl p-1 shadow-sm border">
              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">الاسم الكامل</p>
                  <p className="font-bold text-lg leading-none">{displayUser.name}</p>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">البريد الإلكتروني</p>
                  <p className="font-bold text-base leading-none break-all" dir="ltr">{displayUser.email}</p>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${displayUser.isVerified ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                  {displayUser.isVerified ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">حالة الحساب</p>
                  <p className={`font-bold text-base leading-none ${displayUser.isVerified ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {displayUser.isVerified ? 'موثق' : 'غير موثق'}
                  </p>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">تاريخ الانضمام</p>
                  <p className="font-bold text-base leading-none">{formatDate(displayUser.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
