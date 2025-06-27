import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
}

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
  teams?: { name: string };
  read_count?: number;
  total_targets?: number;
}

interface Config {
  game_session_id: string;
}

const MessageManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'warning' | 'urgent'>('info');
  const [targetType, setTargetType] = useState<'team' | 'category' | 'all'>('all');
  const [targetTeam, setTargetTeam] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(2);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get config
      const { data: configData } = await supabase.from('config').select('*').single();
      setConfig(configData);

      if (!configData) return;

      // Get teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('game_session_id', configData.game_session_id)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      setTeams(teamsData || []);

      // Get messages with read counts
      const { data: messagesData } = await supabase
        .from('team_messages')
        .select(`
          *,
          teams(name)
        `)
        .eq('game_session_id', configData.game_session_id)
        .order('created_at', { ascending: false });

      setMessages(messagesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!title.trim() || !message.trim() || !config) return;

    try {
      setSending(true);

      const messageData = {
        title: title.trim(),
        message: message.trim(),
        message_type: messageType,
        target_type: targetType,
        target_team_id: targetType === 'team' ? targetTeam : null,
        target_category: targetType === 'category' ? targetCategory : null,
        game_session_id: config.game_session_id,
        sender_name: 'Jury',
        expires_at: expiresInHours > 0 
          ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
          : null
      };

      const { error } = await supabase
        .from('team_messages')
        .insert([messageData]);

      if (error) {
        console.error('Error sending message:', error);
        alert('Fout bij versturen van bericht');
        return;
      }

      // Reset form
      setTitle('');
      setMessage('');
      setTargetTeam('');
      setTargetCategory('');
      
      // Reload messages
      loadData();
      
      alert('✅ Bericht verstuurd!');

    } catch (error) {
      console.error('Exception sending message:', error);
      alert('Er ging iets mis bij het versturen');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Weet je zeker dat je dit bericht wilt verwijderen?')) return;

    const { error } = await supabase
      .from('team_messages')
      .delete()
      .eq('id', messageId);

    if (!error) {
      loadData();
    }
  };

  const toggleMessageActive = async (messageId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('team_messages')
      .update({ is_active: !isActive })
      .eq('id', messageId);

    if (!error) {
      loadData();
    }
  };

  // Quick message templates
  const quickMessages = [
    {
      title: "🎯 Halverwege!",
      message: "Jullie doen het geweldig! Nog {time} minuten te gaan!",
      type: "info" as const
    },
    {
      title: "⏰ Laatste 30 minuten",
      message: "Let op: nog 30 minuten! Zorg dat alles is ingediend.",
      type: "warning" as const
    },
    {
      title: "🚨 LAATSTE 10 MINUTEN",
      message: "LAATSTE 10 MINUTEN! Geen nieuwe uploads meer na de tijd!",
      type: "urgent" as const
    },
    {
      title: "👏 Goedgekeurd!",
      message: "Opdracht {assignment} is goedgekeurd! Goed gedaan!",
      type: "success" as const
    },
    {
      title: "❌ Probeer opnieuw",
      message: "Opdracht {assignment} moet opnieuw. Check de feedback en probeer nogmaals!",
      type: "warning" as const
    }
  ];

  const useQuickMessage = (template: typeof quickMessages[0]) => {
    setTitle(template.title);
    setMessage(template.message);
    setMessageType(template.type);
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 border-green-300 text-green-800';
      case 'warning': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'urgent': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-blue-100 border-blue-300 text-blue-800';
    }
  };

  const getTargetDisplay = (msg: TeamMessage) => {
    if (msg.target_type === 'all') return 'Alle teams';
    if (msg.target_type === 'category') return `Categorie: ${msg.target_category}`;
    if (msg.target_type === 'team') return `Team: ${msg.teams?.name || 'Onbekend'}`;
    return 'Onbekend';
  };

  if (loading) return <div>Laden...</div>;

  return (
    <div className="page-container">
      <div className="messages-header">
        <h2>📢 Team Berichten</h2>
        <div className="messages-stats">
          <span className="stat">📊 {messages.length} berichten verstuurd</span>
          <span className="stat">👥 {teams.length} teams</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-messages">
        <h3>⚡ Snelle berichten</h3>
        <div className="quick-buttons">
          {quickMessages.map((template, index) => (
            <button
              key={index}
              onClick={() => useQuickMessage(template)}
              className={`quick-msg-btn ${template.type}`}
            >
              {template.title}
            </button>
          ))}
        </div>
      </div>

      {/* Send Message Form */}
      <div className="send-message-form">
        <h3>✉️ Nieuw bericht versturen</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label>Titel:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv: Opdracht goedgekeurd!"
              maxLength={100}
            />
          </div>
          
          <div className="form-group">
            <label>Type:</label>
            <select value={messageType} onChange={(e) => setMessageType(e.target.value as any)}>
              <option value="info">ℹ️ Info</option>
              <option value="success">✅ Succes</option>
              <option value="warning">⚠️ Waarschuwing</option>
              <option value="urgent">🚨 Urgent</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Bericht:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Typ je bericht hier..."
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Verstuur naar:</label>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value as any)}>
              <option value="all">📢 Alle teams</option>
              <option value="category">🏷️ Specifieke categorie</option>
              <option value="team">👥 Specifiek team</option>
            </select>
          </div>

          {targetType === 'category' && (
            <div className="form-group">
              <label>Categorie:</label>
              <select value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
                <option value="">Selecteer categorie...</option>
                <option value="AVFV">AVFV</option>
                <option value="MR">MR</option>
                <option value="JEM">JEM</option>
              </select>
            </div>
          )}

          {targetType === 'team' && (
            <div className="form-group">
              <label>Team:</label>
              <select value={targetTeam} onChange={(e) => setTargetTeam(e.target.value)}>
                <option value="">Selecteer team...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Verloopt na (uren):</label>
            <input
              type="number"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(parseInt(e.target.value) || 0)}
              min="0"
              max="24"
            />
          </div>
        </div>

        <button
          onClick={sendMessage}
          disabled={sending || !title.trim() || !message.trim()}
          className="send-btn"
        >
          {sending ? '📤 Versturen...' : '📤 Verstuur bericht'}
        </button>
      </div>

      {/* Messages List */}
      <div className="messages-list">
        <h3>📋 Verstuurde berichten ({messages.filter(m => m.is_active).length} actief)</h3>
        
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>Nog geen berichten verstuurd. Verstuur je eerste bericht hierboven!</p>
          </div>
        ) : (
          <div className="messages-grid">
            {messages.map(msg => (
              <div key={msg.id} className={`message-card ${getMessageTypeColor(msg.message_type)} ${!msg.is_active ? 'inactive' : ''}`}>
                <div className="message-header">
                  <div className="message-title">{msg.title}</div>
                  <div className="message-actions">
                    <button
                      onClick={() => toggleMessageActive(msg.id, msg.is_active)}
                      className={`toggle-btn ${msg.is_active ? 'active' : 'inactive'}`}
                      title={msg.is_active ? 'Deactiveer' : 'Activeer'}
                    >
                      {msg.is_active ? '👁️' : '🙈'}
                    </button>
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="delete-btn"
                      title="Verwijder"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="message-content">{msg.message}</div>
                
                <div className="message-meta">
                  <div className="message-target">{getTargetDisplay(msg)}</div>
                  <div className="message-time">
                    {new Date(msg.created_at).toLocaleString('nl-NL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                {msg.expires_at && (
                  <div className="message-expires">
                    Verloopt: {new Date(msg.expires_at).toLocaleString('nl-NL')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageManagement;