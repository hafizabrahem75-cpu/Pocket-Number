import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const forgotMutation = useForgotPassword();

  const onSubmit = (data: FormValues) => {
    forgotMutation.mutate(
      { data: { email: data.email } },
      {
        onSuccess: (res) => {
          // Persist email for the reset page to consume
          sessionStorage.setItem("pn_reset_email", data.email);

          // In development, the server returns the code so the flow can be
          // tested without a real email provider.
          if (res.devCode) {
            sessionStorage.setItem("pn_reset_dev_code", res.devCode);
          } else {
            sessionStorage.removeItem("pn_reset_dev_code");
          }

          setLocation("/reset-password");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "حدث خطأ",
            description: error?.data?.error ?? error?.message ?? "تعذّر إرسال رمز الاسترداد",
          });
        },
      },
    );
  };

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col p-6 pt-12">
        <Link
          href="/login"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-8"
        >
          <ArrowRight className="ml-2 w-5 h-5" />
          <span className="font-medium">رجوع</span>
        </Link>

        <div className="space-y-2 mb-10">
          <h1 className="text-3xl font-extrabold text-foreground">نسيت كلمة المرور؟</h1>
          <p className="text-muted-foreground">
            أدخل بريدك الإلكتروني وسنرسل لك رمز التحقق لإعادة تعيين كلمة المرور
          </p>
        </div>

        {/* Icon illustration */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      className="text-left"
                      dir="ltr"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-auto pt-8 pb-4 space-y-4">
              <Button
                type="submit"
                size="lg"
                className="w-full text-lg shadow-lg shadow-primary/25"
                disabled={forgotMutation.isPending}
              >
                {forgotMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  "إرسال رمز التحقق"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                تذكّرت كلمة المرور؟{" "}
                <Link href="/login" className="text-primary font-bold hover:underline">
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          </form>
        </Form>
      </div>
    </MobileLayout>
  );
}
