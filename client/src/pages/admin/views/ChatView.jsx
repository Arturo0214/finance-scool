import { useState, useEffect, useRef } from 'react';
import { C, SPANISH_LABELS } from '../constants';
import { Send, Hash } from 'lucide-react';
import { api } from '../../../utils/api';

export default function ChatView({ messages, onSendMessage, messageInputRef }) {
  const [messageText, setMessageText]     = useState('');
  const [activeChannel, setActiveChannel] = useState('general');
  const [channelMessages, setChannelMessages] = useState(messages);
  const messagesEndRef = useRef(null);
  const channels = ['general', 'ventas', 'soporte'];

  useEffect(() => { setChannelMessages(messages); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [channelMessages]);

  const handleSend = () => {
    if (!messageText.trim()) return;
    onSendMessage(messageText);
    setMessageText('');
  };

  const switchChannel = async (ch) => {
    setActiveChannel(ch);
    try {
      const data = await api.getMessages(ch);
      setChannelMessages(data.messages || data || []);
    } catch { setChannelMessages([]); }
  };

  return (
    <>
      <style>{`
        .chat-wrap { background:#fff; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; }
        .msg-list { flex:1; overflow:auto; padding:18px; display:flex; flex-direction:column; gap:10px; }
        .msg-bubble { background:#f8fafc; padding:10px 14px; border-radius:10px; max-width:70%; }
        .msg-head { display:flex; justify-content:space-between; margin-bottom:3px; font-size:12px; }
        .msg-time { color:#94a3b8; font-size:11px; }
        .msg-bubble p { margin:0; font-size:14px; color:#0f172a; }
        .chat-input-bar { display:flex; gap:8px; padding:14px; border-top:1px solid #e2e8f0; }
        .chat-input-bar input { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; font-size:14px; font-family:inherit; outline:none; transition:border-color .2s; }
        .chat-input-bar input:focus { border-color:#003DA5; }
        .send-btn { background:#003DA5; color:#fff; border:none; border-radius:8px; padding:10px 16px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; }
        .send-btn:hover { background:#0066CC; }
        @media(max-width:768px) {
          .chat-wrap { height:auto !important; min-height:300px; max-height:calc(100vh - 240px); }
          .msg-list { padding:12px; }
          .msg-bubble { max-width:85%; }
          .chat-input-bar { padding:10px; gap:6px; }
          .chat-input-bar input { padding:10px; font-size:16px; }
        }
        @media(max-width:480px) {
          .chat-wrap { max-height:calc(100vh - 200px); }
        }
      `}</style>
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.chat}</h1>
      <p className="view-subtitle">Mensajería interna del equipo Finance SCool</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {channels.map(ch => (
          <button key={ch} className={`f-tab${activeChannel === ch ? ' active' : ''}`} onClick={() => switchChannel(ch)}>
            <Hash size={13} style={{ marginRight: 4 }} />{ch}
          </button>
        ))}
      </div>

      <div className="chat-wrap" style={{ height: 520 }}>
        <div className="msg-list">
          {channelMessages.length === 0 ? <p className="empty">{SPANISH_LABELS.noMessages}</p> : (
            channelMessages.map((msg, i) => {
              const isOwn = msg.sender_id === undefined;
              return (
                <div key={msg.id || i} className="msg-bubble" style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', background: isOwn ? C.blueBg : C.bg }}>
                  <div className="msg-head">
                    <strong style={{ color: C.primary }}>{msg.sender_name || msg.sender || 'Usuario'}</strong>
                    <span className="msg-time">{new Date(msg.created_at || msg.createdAt || Date.now()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p>{msg.content}</p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-bar">
          <input
            ref={messageInputRef}
            type="text"
            placeholder={`Escribe en #${activeChannel}...`}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button className="send-btn" onClick={handleSend}><Send size={18} /></button>
        </div>
      </div>
    </div>
    </>
  );
}
