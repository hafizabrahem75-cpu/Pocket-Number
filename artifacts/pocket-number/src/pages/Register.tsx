import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const registerMutation = useRegister();

  const onSubmit = (data: FormValues) => {
    registerMutation.mutate({ data }, {
      onSuccess: (response) => {
        localStorage.setItem("pn_pending_email", data.email);
        if (response.devOtp) {
          localStorage.setItem("pn_dev_otp", response.devOtp);
        } else {
          localStorage.removeItem("pn_dev_otp");
        }
        setLocation("/verify-otp");
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "حدث خطأ",
          description: error.error || "تعذر إنشاء الحساب، يرجى المحاولة لاحقاً.",
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
          <h1 className="text-3xl font-extrabold text-foreground">إنشاء حساب</h1>
          <p className="text-muted-foreground">أدخل بياناتك للحصول على رقمك الخاص</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input placeholder="أحمد محمد" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
                className="w-full text-lg" 
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  "متابعة"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                لديك حساب بالفعل؟{" "}
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
