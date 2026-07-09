import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { useVerifyOtp, useResendOtp } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Loader2, RefreshCw, FlaskConical } from "lucide-react";

export default function VerifyOtp() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("pn_pending_email");
    if (!savedEmail) {
      setLocation("/register");
      return;
    }
    setEmail(savedEmail);

    // Restore dev OTP if present (set by Register page)
    const savedDevOtp = sessionStorage.getItem("pn_dev_otp");
    if (savedDevOtp) setDevOtp(savedDevOtp);

    startTimer();
    return () => clearInterval(timerRef.current!);
  }, [setLocation]);

  const startTimer = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = () => {
    if (otp.length !== 6) return;

    verifyMutation.mutate({ data: { email, code: otp } }, {
      onSuccess: (data) => {
        sessionStorage.removeItem("pn_pending_email");
        sessionStorage.removeItem("pn_dev_otp");
        setDevOtp(null);
        login(data.token, data.user);
        setLocation("/home");
        toast({
          title: "تم التحقق بنجاح",
          description: "مرحباً بك في Pocket Number",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "رمز غير صحيح",
          description: error.error || "تأكد من إدخال الرمز الصحيح والمحاولة مجدداً.",
        });
        setOtp("");
      }
    });
  };

  const handleResend = () => {
    if (countdown > 0) return;
    
    resendMutation.mutate({ data: { email } }, {
      onSuccess: (response) => {
        startTimer();
        // Update or clear dev OTP banner based on server response
        if (response.devOtp) {
          setDevOtp(response.devOtp);
          sessionStorage.setItem("pn_dev_otp", response.devOtp);
        } else {
          setDevOtp(null);
          sessionStorage.removeItem("pn_dev_otp");
        }
        toast({
          title: "تم إرسال الرمز",
          description: "تم إرسال رمز جديد إلى بريدك الإلكتروني",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description: error.error || "تعذر إرسال الرمز، يرجى المحاولة لاحقاً.",
        });
      }
    });
  };

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col p-6 pt-12">
        <Link href="/register" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-8">
          <ArrowRight className="ml-2 w-5 h-5" />
          <span className="font-medium">رجوع</span>
        </Link>

        {/* Dev-only OTP banner — never shown in production */}
        {devOtp && (
          <div className="mb-6 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">وضع التطوير فقط</span>
            </div>
            <p className="text-xs text-amber-600 mb-3 leading-relaxed">
              هذا الرمز يظهر فقط أثناء التطوير. في الإنتاج يُرسَل عبر البريد الإلكتروني.
            </p>
            <div
              className="rounded-xl bg-white border border-amber-200 px-4 py-3 text-center cursor-pointer select-all"
              onClick={() => {
                setOtp(devOtp);
              }}
              title="انقر لنسخ الرمز إلى حقل الإدخال"
            >
              <span className="font-mono text-2xl font-black tracking-[0.4em] text-amber-800" dir="ltr">
                {devOtp}
              </span>
            </div>
            <p className="text-xs text-amber-500 text-center mt-2">انقر على الرمز لملء الحقل تلقائياً</p>
          </div>
        )}

        <div className="space-y-4 mb-12">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">رمز التحقق</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            أرسلنا رمزاً من 6 أرقام إلى<br/>
            <span className="font-bold text-foreground" dir="ltr">{email}</span>
          </p>
        </div>

        <div className="flex flex-col items-center flex-1">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(value) => setOtp(value)}
            disabled={verifyMutation.isPending}
            className="gap-2 justify-center w-full"
            containerClassName="w-full flex justify-center mb-10"
            dir="ltr"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          <Button 
            onClick={handleVerify}
            size="lg" 
            className="w-full text-lg mb-8 shadow-lg shadow-primary/25" 
            disabled={otp.length !== 6 || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "تحقق من الرمز"
            )}
          </Button>

          <div className="mt-auto pb-4 text-center">
            {countdown > 0 ? (
              <p className="text-muted-foreground font-medium flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin-slow opacity-50" />
                <span>إعادة إرسال الرمز خلال <span className="font-bold text-foreground w-8 inline-block text-right">{countdown}</span> ثانية</span>
              </p>
            ) : (
              <Button 
                variant="ghost" 
                onClick={handleResend}
                disabled={resendMutation.isPending}
                className="font-bold text-primary hover:text-primary/80 hover:bg-primary/5"
              >
                {resendMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                لم أستلم الرمز، أرسل مجدداً
              </Button>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
