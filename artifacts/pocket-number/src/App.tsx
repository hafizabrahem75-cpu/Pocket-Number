import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChatLauncherProvider } from '@/contexts/ChatLauncherContext';
import { CallLauncherProvider } from '@/contexts/CallLauncherContext';
import { CallOverlay } from '@/components/CallOverlay';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import Splash from '@/pages/Splash';
import Register from '@/pages/Register';
import VerifyOtp from '@/pages/VerifyOtp';
import Login from '@/pages/Login';
import HomeShell from '@/pages/home/HomeShell';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import SearchPage from '@/pages/SearchPage';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Splash} />
      <Route path="/register" component={Register} />
      <Route path="/verify-otp" component={VerifyOtp} />
      <Route path="/login" component={Login} />
      
      <Route path="/home">
        {() => <ProtectedRoute component={HomeShell} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/search">
        {() => <ProtectedRoute component={SearchPage} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <ChatLauncherProvider>
              <CallLauncherProvider>
                <Router />
                <CallOverlay />
              </CallLauncherProvider>
            </ChatLauncherProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
