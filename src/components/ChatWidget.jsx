"use client";
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

export default function ChatWidget() {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="chat">
      {!hidden && (
        <div className="chat-chips">
          <button type="button" className="chat-close" aria-label="Dismiss" onClick={() => setHidden(true)}>
            <X size={12} />
          </button>
          <span className="chip">Hi!</span>
          <span className="chip">How can I help you?</span>
        </div>
      )}
      <button type="button" className="chat-btn" aria-label="Open chat">
        <MessageCircle size={24} color="#fff" />
      </button>
    </div>
  );
}
