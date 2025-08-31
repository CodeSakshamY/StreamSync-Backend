import { useEffect, useState } from "react";
import supabase from "../lib/supabase";

export default function Chat({ room_id }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Load existing messages
    fetch(`/api/messages?room_id=${room_id}`)
      .then(res => res.json())
      .then(setMessages);

    // Subscribe to new messages
    const channel = supabase
      .channel("chat-room")
      .on("postgres_changes", 
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMessages(prev => [...prev, payload.new])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room_id]);

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
    </div>
  );
}
