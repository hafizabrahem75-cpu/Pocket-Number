import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { ArrowRight, Eye, EyeOff, FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z
  .object({
    code: z.string().length(6, "الرمز مكوّن من 6 أرقام"),
    newPassword: z
      .string()
      .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      .max(100, "كلمة المرور طويلة جداً"),
    confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resetMutation = useResetPassword();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem("pn_reset_email");
    if (!savedEmail) {
      // No email in session — user landed here directly, send back to start
      setLocation("/forgot-password");
      return;
    }
    setEmail(savedEmail);

    const savedDevCode = localStorage.getItem("pn_reset_dev_code");
    if (savedDevCode) setDevCode(savedDevCode);
  }, [setLocation]);

  const onSubmit = (data: FormValues) => {
    resetMutation.mutate(
      { data: { email, code: data.code, newPassword: data.newPassword } },
      {
        onSuccess: () => {
          // Clean up session storage — the flow is complete
          localStorage.removeItem("pn_reset_email");
          localStorage.removeItem("pn_reset_dev_code");

          toast({
            title: "تم تغيير كلمة المرور",
            description: "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة",
          });
          setLocation("/login");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "حدث خطأ",
            description:
              error?.data?.error ??
              error?.message ??
              "رمز التحقق غير صحيح أو انتهت صلاحيته",
          });
        },
      },
    );
  };

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col p-6 pt-12">
        <Link
          href="/forgot-password"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-8"
        >
          <ArrowRight className="ml-2 w-5 h-5" />
          <span className="font-medium">رجوع</span>
        </Link>

        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">إعادة تعيين كلمة المرور</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            أدخل رمز التحقق المرسل إلى{" "}
            <span className="font-semibold text-foreground" dir="ltr">
              {email}
            </span>
          </p>
        </div>

        {/* Dev-mode code banner — hidden in production */}
        {devCode && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
            <FlaskConical className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-0.5">وضع التطوير — الرمز للاختبار فقط</p>
              <p className="text-lg font-black tracking-[0.3em] text-amber-900 font-mono">{devCode}</p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col">
            {/* OTP code input */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center">
                  <FormLabel className="self-start">رمز التحقق</FormLabel>
                  <FormControl>
                    <InputOTP
                      maxLength={6}
                      value={field.value}
                      onChange={field.onChange}
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New password */}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>كلمة المرور الجديدة</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="text-left pl-10"
                        dir="ltr"
                        autoComplete="new-password"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirm password */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••"
                        className="text-left pl-10"
                        dir="ltr"
                        autoComplete="new-password"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showConfirm ? "إخفاء التأكيد" : "إظهار التأكيد"}
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password requirements hint */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>يجب أن تكون كلمة المرور 8 أحرف على الأقل</span>
            </div>

            <div className="mt-auto pt-6 pb-4 space-y-4">
              <Button
                type="submit"
                size="lg"
                className="w-full text-lg shadow-lg shadow-primary/25"
                disabled={resetMutation.isPending || !email}
              >
                {resetMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  "تعيين كلمة المرور الجديدة"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                لم تستلم الرمز؟{" "}
                <Link href="/forgot-password" className="text-primary font-bold hover:underline">
                  أعد المحاولة
                </Link>
              </p>
            </div>
          </form>
        </Form>
      </div>
    </MobileLayout>
  );
}
