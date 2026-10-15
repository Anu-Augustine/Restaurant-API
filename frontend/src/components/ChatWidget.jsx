import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChatPanel } from "./ChatPanel";

export function ChatWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const onChatPage = location.pathname === "/chat";

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (onChatPage) return null;

  return (
    <div className="chat-dock">
      {open && (
        <section className="chat-popup" role="dialog" aria-label="Ask Forkful">
          <header className="chat-popup-bar">
            <strong>Ask Forkful</strong>
            <button type="button" className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <ChatPanel compact />
        </section>
      )}
      <button
        type="button"
        className="chat-launcher"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="2.2" d="M6 6l12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path
              fill="currentColor"
              d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4.2 3.2A1 1 0 0 1 3 19.4V6a2 2 0 0 1 2-2Z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
