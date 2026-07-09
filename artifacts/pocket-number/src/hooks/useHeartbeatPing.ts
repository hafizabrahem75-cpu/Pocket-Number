import { useEffect } from "react";
import { useHeartbeat } from "@workspace/api-client-react";

/**
 * Sends a heartbeat to the server on mount and every 60 seconds
 * while the page is visible, keeping the user's online status fresh.
 */
export function useHeartbeatPing() {
  const { mutate } = useHeartbeat();

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "hidden") {
        mutate();
      }
    };

    // Initial ping on app load
    ping();

    const interval = setInterval(ping, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ping();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [mutate]);
}
