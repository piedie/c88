import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
  game_session_id: string;
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Get current config for session ID
    const { data: configData } = await supabase.from('config').select('game_session_id').single();
    setConfig(configData);

    if (!configData) return;

    // Get teams for current session
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('game_session_id', configData.game_session_id)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    
    setTeams(teamData || []);
  };

  const addTeam = async () => {
    if (!newTeamName.trim() || !config) return;

    const { error } = await supabase.from('teams').insert([{
      name: newTeamName.trim(),
      category: newTeamCategory,
      game_session_id: config.game_session_id,
    }]);

    if (!error) {
      setNewTeamName('');
      fetchData();
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

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Weet je zeker dat je team "${teamName}" wilt verwijderen? Ook alle scores van dit team worden verwijderd.`)) return;

    // Delete scores first (foreign key constraint)
    await supabase.from('scores').delete().eq('team_id', teamId);
    
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
    
    // Delete all teams for current session
    const { error } = await supabase.from('teams').delete().eq('game_session_id', config.game_session_id);
    
    if (!error) {
      fetchData();
    }
  };

  const teamsByCategory = (category: string) => 
    teams.filter(t => t.category === category);

  const categories = ['AVFV', 'MR', 'JEM'];

  return (
    <div>
      <h2>👥 Team Management</h2>
      
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
            Toevoegen
          </button>
        </div>
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
                        <span className="team-name">⭐ {team.name}</span>
                        <div className="team-actions">
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
    </div>
  );
};

export default TeamManagement;