import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
  game_session_id: string;
  access_token?: string;
  qr_code_url?: string;
  token_created_at?: string;
}

interface Config {
  game_session_id: string;
}

const TeamManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCategory, setNewTeamCategory] = useState('AVFV');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showQRModal, setShowQRModal] = useState<Team | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Get current config for session ID
    const { data: configData } = await supabase.from('config').select('game_session_id').single();
    setConfig(configData);

    if (!configData) return;

    // Get teams for current session with tokens
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('game_session_id', configData.game_session_id)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    
    setTeams(teamData || []);
  };

  const generateQRCodeURL = (token: string) => {
    const teamURL = `${window.location.origin}/team/${token}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(teamURL)}`;
  };

  const getTeamURL = (token: string) => {
    return `${window.location.origin}/team/${token}`;
  };

  const addTeam = async () => {
    if (!newTeamName.trim() || !config) return;

    const { data, error } = await supabase.from('teams').insert([{
      name: newTeamName.trim(),
      category: newTeamCategory,
      game_session_id: config.game_session_id,
    }]).select().single();

    if (!error && data) {
      setNewTeamName('');
      fetchData();
      
      // Show QR modal for new team
      setShowQRModal(data);
    }
  };

  const updateTeam = async () => {
    if (!editingTeam || !editingTeam.name.trim()) return;

    const { error } = await supabase
      .from('teams')
      .update({
        name: editingTeam.name.trim(),
        category: editingTeam.category,
      })
      .eq('id', editingTeam.id);

    if (!error) {
      setEditingTeam(null);
      fetchData();
    }
  };

  const regenerateToken = async (teamId: string) => {
    if (!confirm('Weet je zeker dat je een nieuwe QR code wilt genereren? De oude QR code werkt dan niet meer.')) return;

    // Generate new token using database function
    const { data, error } = await supabase
      .rpc('generate_team_token')
      .single();

    if (!error && data) {
      const { error: updateError } = await supabase
        .from('teams')
        .update({
          access_token: data,
          token_created_at: new Date().toISOString()
        })
        .eq('id', teamId);

      if (!updateError) {
        fetchData();
      }
    }
  };

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Weet je zeker dat je team "${teamName}" wilt verwijderen? Ook alle scores van dit team worden verwijderd.`)) return;

    // Delete scores first (foreign key constraint)
    await supabase.from('scores').delete().eq('team_id', teamId);
    
    // Delete submissions if they exist
    await supabase.from('submissions').delete().eq('team_id', teamId);
    
    // Then delete team
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    
    if (!error) {
      fetchData();
    }
  };

  const clearAllTeams = async () => {
    if (!confirm('Weet je zeker dat je ALLE teams en hun scores wilt verwijderen?')) return;
    if (!config) return;

    // Delete all scores for current session
    await supabase.from('scores').delete().eq('game_session_id', config.game_session_id);
    
    // Delete all submissions for current session
    await supabase.from('submissions').delete().eq('game_session_id', config.game_session_id);
    
    // Delete all teams for current session
    const { error } = await supabase.from('teams').delete().eq('game_session_id', config.game_session_id);
    
    if (!error) {
      fetchData();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Link gekopieerd naar klembord!');
    } catch (err) {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Link gekopieerd naar klembord!');
    }
  };

  const downloadQR = (token: string, teamName: string) => {
    const qrURL = generateQRCodeURL(token);
    const link = document.createElement('a');
    link.href = qrURL;
    link.download = `QR_${teamName.replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const teamsByCategory = (category: string) => 
    teams.filter(t => t.category === category);

  const categories = ['AVFV', 'MR', 'JEM'];

  const QRModal = ({ team }: { team: Team }) => (
    <div className="modal-overlay" onClick={() => setShowQRModal(null)}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-header">
          <h3>📱 QR Code voor {team.name}</h3>
          <button 
            className="close-btn"
            onClick={() => setShowQRModal(null)}
          >
            ✕
          </button>
        </div>
        
        <div className="qr-content">
          <div className="qr-code">
            <img 
              src={generateQRCodeURL(team.access_token!)} 
              alt={`QR code voor ${team.name}`}
              onError={(e) => {
                console.error('QR code failed to load');
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5RUiBDb2RlPC90ZXh0Pjwvc3ZnPg==';
              }}
            />
          </div>
          
          <div className="qr-info">
            <p><strong>Team:</strong> {team.name} ({team.category})</p>
            <p><strong>URL:</strong></p>
            <div className="url-box">
              <code>{getTeamURL(team.access_token!)}</code>
              <button 
                onClick={() => copyToClipboard(getTeamURL(team.access_token!))}
                className="copy-btn"
                title="Kopieer link"
              >
                📋
              </button>
            </div>
          </div>
          
          <div className="qr-actions">
            <button 
              onClick={() => downloadQR(team.access_token!, team.name)}
              className="download-btn"
            >
              💾 Download QR
            </button>
            <button 
              onClick={() => window.open(getTeamURL(team.access_token!), '_blank')}
              className="preview-btn"
            >
              👁️ Preview pagina
            </button>
            <button 
              onClick={() => regenerateToken(team.id)}
              className="regenerate-btn"
            >
              🔄 Nieuwe QR
            </button>
          </div>
          
          <div className="qr-instructions">
            <h4>📋 Instructies voor teams:</h4>
            <ol>
              <li>Scan de QR code met je telefoon camera</li>
              <li>Of typ de URL handmatig in je browser</li>
              <li>Bookmark de pagina voor makkelijke toegang</li>
              <li>Meerdere telefoons kunnen dezelfde link gebruiken</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <h2>👥 Team management</h2>
      
      <div className="team-management-section">
        <h3>➕ Nieuw Team Toevoegen</h3>
        <div className="add-team-form">
          <input
            type="text"
            placeholder="Team naam"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTeam()}
          />
          <select 
            value={newTeamCategory} 
            onChange={(e) => setNewTeamCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button onClick={addTeam} disabled={!newTeamName.trim()}>
            ➕ Toevoegen
          </button>
        </div>
        <p className="add-team-note">
          💡 Na het toevoegen krijg je automatisch de QR code te zien
        </p>
      </div>

      <div className="teams-overview">
        <div className="teams-header">
          <h3>📋 Huidige Teams ({teams.length})</h3>
          {teams.length > 0 && (
            <button className="clear-all" onClick={clearAllTeams}>
              🗑️ Alle teams wissen
            </button>
          )}
        </div>

        {categories.map(category => {
          const categoryTeams = teamsByCategory(category);
          if (categoryTeams.length === 0) return null;
          
          return (
            <div key={category} className="category-section">
              <h4>{category} ({categoryTeams.length})</h4>
              <div className="teams-list">
                {categoryTeams.map(team => (
                  <div key={team.id} className="team-item">
                    {editingTeam?.id === team.id ? (
                      <div className="edit-team-form">
                        <input
                          type="text"
                          value={editingTeam.name}
                          onChange={(e) => setEditingTeam({...editingTeam, name: e.target.value})}
                          onKeyPress={(e) => e.key === 'Enter' && updateTeam()}
                        />
                        <select
                          value={editingTeam.category}
                          onChange={(e) => setEditingTeam({...editingTeam, category: e.target.value})}
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <button onClick={updateTeam}>✅ Opslaan</button>
                        <button onClick={() => setEditingTeam(null)}>❌ Annuleren</button>
                      </div>
                    ) : (
                      <div className="team-display">
                        <div className="team-info">
                          <span className="team-name">⭐ {team.name}</span>
                          {team.access_token && (
                            <span className="team-token">
                              🔗 {team.access_token}
                            </span>
                          )}
                        </div>
                        <div className="team-actions">
                          <button 
                            onClick={() => setShowQRModal(team)}
                            className="qr-btn"
                            disabled={!team.access_token}
                            title="Toon QR code"
                          >
                            📱 QR
                          </button>
                          <button onClick={() => setEditingTeam(team)}>✏️ Bewerken</button>
                          <button 
                            className="delete-btn"
                            onClick={() => deleteTeam(team.id, team.name)}
                          >
                            🗑️ Verwijderen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {teams.length === 0 && (
          <div className="no-teams">
            <p>Nog geen teams toegevoegd. Voeg hierboven je eerste team toe!</p>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQRModal && <QRModal team={showQRModal} />}
    </div>
  );
};

export default TeamManagement;