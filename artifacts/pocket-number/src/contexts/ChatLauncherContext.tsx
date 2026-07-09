import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Minimal identity needed to open a conversation — a subset of ConversationListItem
 * so this works whether or not a conversation already exists between the two users.
 */
export interface ChatTarget {
  peerId: number;
  peerName: string;
  peerPocketNumber: string;
}

interface ChatLauncherState {
  /** Set when some page (contacts, search) wants HomeShell to open a chat. */
  pendingTarget: ChatTarget | null;
  /** Request that a conversation with this user be opened. */
  requestChat: (target: ChatTarget) => void;
  /** Called once the request has been handled (conversation opened). */
  consumePendingTarget: () => void;
}

const ChatLauncherContext = createContext<ChatLauncherState | null>(null);

export function ChatLauncherProvider({ children }: { children: ReactNode }) {
  const [pendingTarget, setPendingTarget] = useState<ChatTarget | null>(null);

  const requestChat = useCallback((target: ChatTarget) => {
    setPendingTarget(target);
  }, []);

  const consumePendingTarget = useCallback(() => {
    setPendingTarget(null);
  }, []);

  return (
    <ChatLauncherContext.Provider value={{ pendingTarget, requestChat, consumePendingTarget }}>
      {children}
    </ChatLauncherContext.Provider>
  );
}

export function useChatLauncher() {
  const ctx = useContext(ChatLauncherContext);
  if (!ctx) {
    throw new Error("useChatLauncher must be used within a ChatLauncherProvider");
  }
  return ctx;
}
