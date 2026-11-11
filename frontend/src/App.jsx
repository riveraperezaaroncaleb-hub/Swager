import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef(null);

  async function loadConversations() {
    try {
      const response = await fetch(`${API_URL}/ia/conversaciones`);
      if (!response.ok) throw new Error("No se pudieron cargar las conversaciones.");
      const data = await response.json();
      setConversations(data.conversaciones);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, busy]);

  async function sendQuestion(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;

    setMessages((current) => [
      ...current,
      { role: "user", text: prompt },
      { role: "assistant", text: "" }
    ]);
    setQuestion("");
    setError("");
    setBusy(true);

    try {
      const response = await fetch(`${API_URL}/ia/preguntar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta: prompt,
          ...(conversationId && { conversacionId: conversationId })
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo obtener una respuesta.");
      }
      if (!response.body) throw new Error("El navegador no admite respuestas en streaming.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError = "";
      const handleEvent = (rawEvent) => {
        const dataLine = rawEvent.split(/\r?\n/).find((line) => line.startsWith("data:"));
        if (!dataLine) return;
        const event = JSON.parse(dataLine.slice(5).trim());
        if (event.type === "conversation") setConversationId(event.conversationId);
        if (event.type === "delta") {
          setMessages((current) => {
            const updated = [...current];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, text: last.text + event.text };
            }
            return updated;
          });
        }
        if (event.type === "done") {
          setMessages((current) => {
            const updated = [...current];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                model: event.uso?.modeloUsado
              };
            }
            return updated;
          });
        }
        if (event.type === "error") streamError = event.error;
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";
        events.forEach(handleEvent);
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);
      if (streamError) throw new Error(streamError);
      await loadConversations();
    } catch (requestError) {
      setError(requestError.message);
      setMessages((current) => current.filter((message) => message.text || message.role !== "assistant"));
    } finally {
      setBusy(false);
    }
  }

  async function openConversation(id) {
    if (busy) return;
    setError("");
    try {
      const response = await fetch(`${API_URL}/ia/conversaciones/${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo abrir la conversación.");
      setConversationId(id);
      setMessages(data.conversacion.mensajes.map((message) => ({
        role: message.role,
        text: message.content
      })));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function startNewChat() {
    setMessages([]);
    setConversationId("");
    setError("");
    setQuestion("");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="DocuAI Enterprise">
          <span className="brand-mark">D</span>
          <span>DocuAI <small>ENTERPRISE</small></span>
        </a>
        <button className="new-chat" onClick={startNewChat}>＋ <span>Nuevo chat</span></button>
        <div className="sidebar-label">ESPACIO DE TRABAJO</div>
        <div className="sidebar-item active"><span>✦</span> Asistente IA</div>
        {conversations.length > 0 && (
          <>
            <div className="sidebar-label conversation-label">RECENTES</div>
            <nav className="conversation-list" aria-label="Conversaciones guardadas">
              {conversations.map((conversation) => (
                <button
                  className={`conversation-link ${conversationId === conversation.id ? "selected" : ""}`}
                  key={conversation.id}
                  onClick={() => openConversation(conversation.id)}
                  disabled={busy}
                  title={conversation.titulo}
                >
                  <span>◷</span>{conversation.titulo}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-note">
          <span className="provider-dot" />
          <div><strong>DeepSeek</strong><small>Conectado al backend</small></div>
        </div>
        <div className="sidebar-footer">Tus preguntas se procesan de forma segura en el servidor.</div>
      </aside>

      <section className="chat-layout">
        <header className="chat-topbar">
          <div className="mobile-brand"><span className="brand-mark">D</span> DocuAI</div>
          <span className="model-pill"><span className="provider-dot" /> DeepSeek AI</span>
        </header>

        <div className={`conversation ${messages.length === 0 ? "conversation-empty" : ""}`} ref={messageListRef} aria-live="polite">
          {messages.length === 0 ? (
            <section className="welcome">
              <span className="welcome-icon">✦</span>
              <div className="welcome-kicker">DOCUAI ENTERPRISE · ASISTENTE IA</div>
              <h1>¿En qué puedo <span>ayudarte?</span></h1>
              <p>Pregunta sobre tus ideas, notas o minutas. DeepSeek te responderá en español.</p>
              <div className="suggestions">
                {[
                  "¿Cómo puedo organizar una minuta de reunión?",
                  "Dame ideas para resumir un documento",
                  "¿Qué información debe llevar un acta?"
                ].map((suggestion) => (
                  <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}<span>↗</span></button>
                ))}
              </div>
            </section>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${index}-${message.role}`}>
                  <div className="message-avatar">{message.role === "assistant" ? "D" : "TÚ"}</div>
                  <div className="message-body">
                    <div className="message-label">{message.role === "assistant" ? "DEEPSEEK" : "TÚ"}</div>
                    <p>{message.text || (busy && message.role === "assistant" ? "…" : "")}</p>
                    {message.model && <small className="model-caption">{message.model}</small>}
                  </div>
                </article>
              ))}
              {busy && (
                <article className="message assistant">
                  <div className="message-avatar">D</div>
                  <div className="message-body">
                    <div className="message-label">DEEPSEEK</div>
                    <div className="typing"><i /><i /><i /><span>Preparando respuesta...</span></div>
                  </div>
                </article>
              )}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="alert" role="alert">{error}</div>}
          <form className="composer" onSubmit={sendQuestion}>
            <textarea
              aria-label="Escribe tu pregunta"
              placeholder="Escribe tu pregunta..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }}
              maxLength={5000}
              rows={2}
              disabled={busy}
            />
            <div className="composer-bottom">
              <span>Enter para enviar · Shift + Enter para nueva línea</span>
              <button type="submit" disabled={busy || !question.trim()} aria-label="Enviar pregunta">
                {busy ? "…" : "↑"}
              </button>
            </div>
          </form>
          <p className="disclaimer">La IA puede cometer errores. No compartas información confidencial.</p>
        </div>
      </section>
    </main>
  );
}
