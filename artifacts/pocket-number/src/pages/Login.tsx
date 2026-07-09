import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  const onSubmit = (data: FormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        login(res.token, res.user);
        setLocation("/home");
        toast({
          title: "تم تسجيل الدخول",
          description: `مرحباً بعودتك، ${res.user.name}`,
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description: error.error || "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        });
      }
    });
  };

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col p-6 pt-12">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-8">
          <ArrowRight className="ml-2 w-5 h-5" />
          <span className="font-medium">رجوع</span>
        </Link>
        
        <div className="space-y-2 mb-10">
          <h1 className="text-3xl font-extrabold text-foreground">تسجيل الدخول</h1>
          <p className="text-muted-foreground">أدخل بياناتك للوصول إلى رقمك الخاص</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" className="text-left" dir="ltr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="text-left" dir="ltr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-auto pt-8 pb-4 space-y-4">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full text-lg shadow-lg shadow-primary/25" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  "تسجيل الدخول"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ليس لديك حساب؟{" "}
                <Link href="/register" className="text-primary font-bold hover:underline">
                  إنشاء حساب
                </Link>
              </p>
            </div>
          </form>
        </Form>
      </div>
    </MobileLayout>
  );
}
