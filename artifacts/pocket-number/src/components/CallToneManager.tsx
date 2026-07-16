import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCallTones } from "@/hooks/useCallTones";

/**
 * Zero-UI component that mounts once inside CallLauncherProvider and drives
 * all call audio/haptic feedback through useCallTones.
 *
 * Keeping tone management in its own component (rather than inside the
 * overlays themselves) means tones start and stop correctly even during the
 * brief animation windows when overlays are mounting/unmounting — the
 * CallLauncherContext state is the single source of truth.
 */
export function CallToneManager() {
  const { incomingCall, activeCall } = useCallLauncher();
  const { user } = useAuth();

  useCallTones({
    incomingCall,
    activeCall,
    myUserId: user?.id ?? null,
  });

  return null;
}
