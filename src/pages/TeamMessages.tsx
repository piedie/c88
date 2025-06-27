import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface TeamMessage {
  id: string;
  title: string;
  message: string;
  message_type: 'info' | 'success' | 'warning' | 'urgent';
  target_type: 'team' | 'category' | 'all';
  target_team_id?: string;
  target_category?: string;
  game_session_id: string;
  sender_name: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  is_read?: boolean;
}

interface Team {
  id: string;
  name: string;
  category: string;
  game_session_id: string;
}

const TeamMessages = ({ team }: { team: Team }) => {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentMessage, setUrgentMessage] = useState<TeamMessage | null>(null);

  useEffect(() => {
    loadMessages();
    
    // Set up real-time subscription voor nieuwe berichten
    const subscription = supabase
      .channel('team_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `game_session_id=eq.${team.game_session_id}`
        },
        () => {
          loadMessages(); // Reload when new message arrives
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [team]);

  const loadMessages = async () => {
    try {
      // Get messages for this team
      const { data: messagesData, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('game_session_id', team.game_session_id)
        .eq('is_active', true)
        .or(`target_type.eq.all,and(target_type.eq.category,target_category.eq.${team.category}),and(target_type.eq.team,target_team_id.eq.${team.id})`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      // Get read status for each message
      const { data: readData } = await supabase
        .from('team_message_reads')
        .select('message_id')
        .eq('team_id', team.id);

      const readMessageIds = new Set(readData?.map(r => r.message_id) || []);

      // Filter out expired messages and add read status
      const now = new Date();
      const activeMessages = (messagesData || [])
        .filter(msg => !msg.expires_at || new Date(msg.expires_at) > now)
        .map(msg => ({
          ...msg,
          is_read: readMessageIds.has(msg.id)
        }));

      setMessages(activeMessages);

      // Count unread messages
      const unread = activeMessages.filter(msg => !msg.is_read).length;
      setUnreadCount(unread);

      // Check for urgent messages
      const urgent = activeMessages.find(msg => 
        msg.message_type === 'urgent' && !msg.is_read
      );
      setUrgentMessage(urgent || null);

    } catch (error) {
      console.error('Exception loading messages:', error);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('team_message_reads')
        .upsert({
          message_id: messageId,
          team_id: team.id
        }, {
          onConflict: 'message_id,team_id'
        });

      if (!error) {
        // Update local state
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        ));
        
        // Update unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Remove urgent message if it was the one marked as read
        if (urgentMessage?.id === messageId) {
          setUrgentMessage(null);
        }
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const getMessageTypeEmoji = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'urgent': return '🚨';
      default: return 'ℹ️';
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 border-green-300 text-green-800';
      case 'warning': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'urgent': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-blue-100 border-blue-300 text-blue-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60));
    if (minutes < 1) return 'zojuist';
    if (minutes < 60) return `${minutes}m geleden`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}u geleden`;
    return `${Math.floor(hours / 24)}d geleden`;
  };

  return (
    <>
      {/* Urgent Banner */}
      {urgentMessage && (
        <div className="urgent-banner">
          <div>🚨 {urgentMessage.title}: {urgentMessage.message}</div>
          <button 
            onClick={() => markAsRead(urgentMessage.id)}
            style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: '1px solid white', 
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              marginLeft: '1rem',
              cursor: 'pointer'
            }}
          >
            Gelezen
          </button>
        </div>
      )}

      {/* Floating Messages Button */}
      <div className="team-messages-float">
        <button
          onClick={() => setShowMessages(!showMessages)}
          className="messages-toggle-btn"
          title="Berichten van jury"
        >
          📢
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </button>

        {/* Messages Panel */}
        {showMessages && (
          <div className="team-messages-panel">
            <div className="messages-panel-header">
              <h3>📢 Berichten van jury</h3>
              <button 
                onClick={() => setShowMessages(false)}
                className="close-messages-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="messages-panel-content">
              {messages.length === 0 ? (
                <div className="no-team-messages">
                  <p>Nog geen berichten ontvangen</p>
                </div>
              ) : (
                messages.map(message => (
                  <div 
                    key={message.id} 
                    className={`team-message-item ${message.is_read ? 'read' : 'unread'} ${getMessageTypeColor(message.message_type)}`}
                  >
                    <div className="team-message-header">
                      <div className="team-message-title">
                        {getMessageTypeEmoji(message.message_type)} {message.title}
                      </div>
                      <div className="team-message-time">
                        {formatTimeAgo(message.created_at)}
                      </div>
                    </div>
                    
                    <div className="team-message-content">
                      {message.message}
                    </div>
                    
                    {!message.is_read && (
                      <button
                        onClick={() => markAsRead(message.id)}
                        className="mark-read-btn"
                      >
                        ✅ Markeer als gelezen
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TeamMessages;