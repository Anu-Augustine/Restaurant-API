import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { confirmChat, getChatHistory, getMenu, parseConfirmation, sendChat } from "../api";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../format";
import { Empty, ErrorNote, Loading } from "./Status";

const SESSION_KEY = "chat_session_id";

export function ChatPanel({ compact = false }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");
  const [messages, setMessages] = useState([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getMenu()
      .then((items) => {
        if (!cancelled) setMenu(items);
      })
      .catch(() => {
        if (!cancelled) setMenu([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    const stored = sessionStorage.getItem(SESSION_KEY) || "";
    if (stored) setSessionId(stored);
    if (!user || !stored) {
      setHistoryReady(true);
      return undefined;
    }
    setHistoryReady(false);
    getChatHistory(stored)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => {
        if (!cancelled && err.status !== 401) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setHistoryReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user?.id]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, sending]);

  function startNewConversation() {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionId("");
    setMessages([]);
    setError("");
  }

  async function onSubmit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text) {
      setError("Type a question before sending.");
      return;
    }
    if (text.length > 1000) {
      setError("Keep the question to 1000 characters or fewer.");
      return;
    }
    setQuestion("");
    setError("");
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    try {
      const data = await sendChat(text, sessionId);
      if (data?.session_id) {
        sessionStorage.setItem(SESSION_KEY, data.session_id);
        setSessionId(data.session_id);
      }
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data?.answer || "",
          sources: data?.sources || [],
        },
      ]);
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || "The chatbot could not answer. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  async function onConfirm(payload) {
    if (!user) {
      navigate("/login", { state: { from: "/chat" } });
      return;
    }
    setConfirming(true);
    setError("");
    try {
      const result = await confirmChat(payload);
      const total =
        result.total_amount != null ? ` Total ${formatINR(result.total_amount)}.` : "";
      const content = `${result.message || "Confirmed."} Order #${result.order_id} is ${result.status}.${total}`;
      setMessages((current) => [
        ...current,
        { id: `local-${Date.now()}`, role: "assistant", content },
      ]);
    } catch (err) {
      if (err.status !== 401) setError(err.message || "Confirmation failed.");
    } finally {
      setConfirming(false);
    }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className={compact ? "chat-panel compact" : "chat-panel"}>
      {!compact && (
        <div className="page-intro chat-intro">
          <div>
            <h1>Ask Forkful</h1>
            <p>
              Ask about the menu, the restaurant, or your orders.
              {user ? " You are logged in, so order status and history can be answered." : " Log in before asking about your orders."}
            </p>
          </div>
          <button type="button" className="button ghost" onClick={startNewConversation}>
            New conversation
          </button>
        </div>
      )}
      {compact && (
        <button type="button" className="chat-new" onClick={startNewConversation}>
          New
        </button>
      )}
      <ErrorNote>{error}</ErrorNote>
      {!historyReady && <Loading>Loading this conversation…</Loading>}
      <div className="thread" ref={threadRef}>
        {historyReady && messages.length === 0 && (
          <Empty>Ask about the menu, a dish, or an order.</Empty>
        )}
        {messages.map((message, index) => {
          const confirmation =
            index === lastIndex ? parseConfirmation(message.content, menu) : null;
          const asksToConfirm =
            index === lastIndex &&
            /place_order|cancel_order|nothing has been placed yet/i.test(message.content || "");
          return (
            <article key={message.id ?? `${message.role}-${index}`} className={`bubble ${message.role}`}>
              <p className="bubble-text">{message.content}</p>
              {message.sources?.length > 0 && (
                <p className="sources">
                  Sources: {message.sources.map((source) => source.title).filter(Boolean).join(", ")}
                </p>
              )}
              {confirmation && (
                <button
                  type="button"
                  className="button"
                  disabled={confirming}
                  onClick={() => onConfirm(confirmation)}
                >
                  {confirming
                    ? "Confirming…"
                    : confirmation.action === "cancel_order"
                      ? `Cancel order #${confirmation.order_id}`
                      : user
                        ? "Confirm order"
                        : "Log in to confirm"}
                </button>
              )}
              {asksToConfirm && !confirmation && (
                <p className="fine">This preview could not be confirmed because the dish ids were not in the reply.</p>
              )}
            </article>
          );
        })}
        {sending && <p className="banner">Forkful is thinking…</p>}
      </div>
      <form className="chat-form" onSubmit={onSubmit}>
        <label className="field">
          <span className="sr-only">Question</span>
          <textarea
            rows={compact ? 2 : 3}
            maxLength="1000"
            placeholder="Ask about the menu or an order"
            aria-label="Question"
            value={question}
            disabled={!historyReady || sending}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <div className="chat-form-row">
          <span className="muted">{question.trim().length}/1000</span>
          <button type="submit" className="button" disabled={!historyReady || sending}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
