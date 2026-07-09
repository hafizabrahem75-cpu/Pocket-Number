import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, LogOut, Loader2, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout(); // Logout from context which redirects to /login
        toast({
          title: "تم تسجيل الخروج",
          description: "نراك قريباً",
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
          <h1 className="text-xl font-bold flex-1">الإعدادات</h1>
        </header>

        <div className="p-6 space-y-6">
          <div className="bg-background rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <div className="font-bold">المساعدة والدعم</div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <div className="font-bold">الشروط والأحكام</div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <div className="font-bold">سياسة الخصوصية</div>
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
                تسجيل الخروج
              </>
            )}
          </Button>
          
          <p className="text-center text-sm text-muted-foreground pt-8">
            الإصدار 1.0.0
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
