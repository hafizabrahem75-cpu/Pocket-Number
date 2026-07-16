import { Link } from "wouter";
import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";

export default function Splash() {
  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col justify-between p-8 pt-20 pb-12 bg-gradient-to-br from-primary/10 to-background">

        {/* Brand + headline + subtitle — grouped so the value prop reads right below the logo */}
        <div
          className="flex flex-col items-center text-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700"
          dir="rtl"
        >
          {/* Logo + brand name */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 bg-primary rounded-[1.75rem] shadow-xl flex items-center justify-center text-primary-foreground transform rotate-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                <path d="M14.05 2a9 9 0 0 1 8 7.94" />
                <path d="M14.05 6A5 5 0 0 1 18 10" />
              </svg>
            </div>
            <p className="text-xs font-bold tracking-[0.2em] text-primary/60 uppercase" dir="ltr">
              Pocket Number
            </p>
          </div>

          {/* Headline + subtitle */}
          <div className="flex flex-col gap-4">
            <h1 className="text-[1.85rem] leading-snug font-extrabold text-foreground tracking-tight">
              تواصل بأمان دون مشاركة رقم هاتفك الحقيقي.
            </h1>
            <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
              أنشئ رقم Pocket Number الخاص بك، وأرسل الرسائل وأجرِ المكالمات
              مع أي مستخدم بسهولة وخصوصية، دون الحاجة إلى مشاركة رقم هاتفك الحقيقي.
            </p>
          </div>
        </div>

        {/* Buttons — anchored to bottom */}
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
          <Link href="/register" className="w-full block">
            <Button size="lg" className="w-full text-lg shadow-lg shadow-primary/25">
              إنشاء حساب جديد
            </Button>
          </Link>
          <Link href="/login" className="w-full block">
            <Button variant="outline" size="lg" className="w-full text-lg border-2">
              تسجيل الدخول
            </Button>
          </Link>
        </div>

      </div>
    </MobileLayout>
  );
}
