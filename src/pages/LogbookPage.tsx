import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface LogEntry {
  id: string;
  team_id: string;
  assignment_id: number;
  points: number;
  created_at: string;
  team_name: string;
  team_category: string;
}

interface Config {
  game_session_id: string;
}

const LogbookPage = () => {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'AVFV' | 'MR' | 'JEM'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Get current config for session ID
    const { data: configData } = await supabase.from('config').select('game_session_id').single();
    setConfig(configData);

    if (!configData) {
      setLoading(false);
      return;
    }

    // Get all scores with team info for current session
    const { data: scoreData } = await supabase
      .from('scores')
      .select(`
        id,
        team_id,
        assignment_id,
        points,
        created_at,
        teams!inner(name, category)
      `)
      .eq('game_session_id', configData.game_session_id)
      .order('created_at', { ascending: false });

    // Transform data to include team info directly
    const entries: LogEntry[] = scoreData?.map(score => ({
      id: score.id,
      team_id: score.team_id,
      assignment_id: score.assignment_id,
      points: score.points,
      created_at: score.created_at,
      team_name: (score.teams as any).name,
      team_category: (score.teams as any).category,
    })) || [];

    setLogEntries(entries);
    setLoading(false);
  };

  const deleteScore = async (scoreId: string, teamName: string, assignmentId: number, points: number) => {
    const pointType = points === 5 ? 'creativiteitspunten' : `${points} punt${points !== 1 ? 'en' : ''}`;
    
    if (!confirm(`Weet je zeker dat je de ${pointType} voor opdracht ${assignmentId} van team "${teamName}" wilt verwijderen?`)) {
      return;
    }

    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', scoreId);

    if (!error) {
      fetchData(); // Refresh the log
    } else {
      alert('Er ging iets mis bij het verwijderen van de score.');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('nl-NL', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL');
  };

  const getPointTypeLabel = (points: number) => {
    if (points === 5) return '🎨 Creativiteit';
    if (points === 2) return '🔁 Dubbel';
    return '⭐ Normaal';
  };

  const getPointTypeClass = (points: number) => {
    if (points === 5) return 'creativity-points';
    if (points === 2) return 'double-points';
    return 'normal-points';
  };

  const filteredEntries = filter === 'all' 
    ? logEntries 
    : logEntries.filter(entry => entry.team_category === filter);

  const totalEntries = logEntries.length;
  const totalPoints = logEntries.reduce((sum, entry) => sum + entry.points, 0);

  if (loading) return <div>Laden...</div>;

  return (
    <div>
      <div className="logbook-header">
        <h2>📋 Logboek</h2>
        <div className="logbook-stats">
          <span className="stat">
            📊 {totalEntries} acties
          </span>
          <span className="stat">
            🏆 {totalPoints} totale punten
          </span>
        </div>
      </div>

      <div className="logbook-controls">
        <div className="filter-controls">
          <label>Filter per categorie:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Alle categorieën</option>
            <option value="AVFV">AVFV</option>
            <option value="MR">MR</option>
            <option value="JEM">JEM</option>
          </select>
        </div>
        <button onClick={fetchData} className="refresh-btn">
          🔄 Vernieuwen
        </button>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="no-entries">
          <p>
            {filter === 'all' 
              ? 'Nog geen punten toegekend. Begin met het spel om hier activiteit te zien!'
              : `Nog geen punten toegekend aan teams in categorie ${filter}.`
            }
          </p>
        </div>
      ) : (
        <div className="logbook-entries">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="log-entry">
              <div className="entry-main">
                <div className="entry-info">
                  <div className="entry-team">
                    <span className="team-category">{entry.team_category}</span>
                    <span className="team-name">⭐ {entry.team_name}</span>
                  </div>
                  <div className="entry-assignment">
                    <span className="assignment-text">voltooide opdracht</span>
                    <span className="assignment-number">#{entry.assignment_id}</span>
                  </div>
                  <div className={`entry-points ${getPointTypeClass(entry.points)}`}>
                    <span className="points-label">{getPointTypeLabel(entry.points)}</span>
                    <span className="points-value">+{entry.points}</span>
                  </div>
                </div>
                
                <div className="entry-meta">
                  <div className="entry-time">
                    <span className="time">{formatTime(entry.created_at)}</span>
                    <span className="date">{formatDate(entry.created_at)}</span>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={() => deleteScore(entry.id, entry.team_name, entry.assignment_id, entry.points)}
                    title="Verwijder deze score"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredEntries.length > 0 && (
        <div className="logbook-summary">
          <p>
            {filter === 'all' 
              ? `Totaal ${filteredEntries.length} van ${totalEntries} acties getoond`
              : `${filteredEntries.length} acties voor categorie ${filter}`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default LogbookPage;