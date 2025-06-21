import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
  game_session_id: string;
}

interface Config {
  id: number;
  double_points_active: boolean;
  timer_duration: number;
  timer_start_time: string | null;
  timer_is_running: boolean;
  game_session_id: string;
}

const AdminPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [completedAssignments, setCompletedAssignments] = useState<number[]>([]);
  const [timerInput, setTimerInput] = useState('');
  const [showCreativityModal, setShowCreativityModal] = useState(false);
  const [creativityTeam, setCreativityTeam] = useState<Team | null>(null);
  const [creativityAssignment, setCreativityAssignment] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    // Get current config
    const { data: configData } = await supabase.from('config').select('*').single();
    setConfig(configData);

    if (!configData) return;

    // Get teams for current session
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('game_session_id', configData.game_session_id);
    
    setTeams(teamData || []);

    // Get scores for current session
    const { data: scoreData } = await supabase
      .from('scores')
      .select('team_id, points')
      .eq('game_session_id', configData.game_session_id);
    
    // Calculate total scores per team
    const scores: {[key: string]: number} = {};
    scoreData?.forEach(score => {
      scores[score.team_id] = (scores[score.team_id] || 0) + score.points;
    });
    setTeamScores(scores);
  };

  const fetchCompletedAssignments = async (teamId: string) => {
    if (!config) return;
    
    const { data: scores } = await supabase
      .from('scores')
      .select('assignment_id')
      .eq('team_id', teamId)
      .eq('game_session_id', config.game_session_id);
    
    const completed = scores?.map(s => s.assignment_id) || [];
    setCompletedAssignments(completed);
  };

  const updateTimer = async () => {
    // Fetch latest config to get current timer state
    const { data: latestConfig } = await supabase.from('config').select('*').single();
    if (!latestConfig?.timer_is_running || !latestConfig.timer_start_time) {
      setCurrentTime(latestConfig?.timer_duration || 0);
      return;
    }
    
    const startTime = new Date(latestConfig.timer_start_time).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - startTime) / 1000);
    const remaining = Math.max(0, latestConfig.timer_duration - elapsed);
    
    setCurrentTime(remaining);
    
    if (remaining === 0 && latestConfig.timer_is_running) {
      // Timer finished - auto stop
      await supabase.from('config').update({ timer_is_running: false }).eq('id', latestConfig.id);
      setConfig({ ...latestConfig, timer_is_running: false });
    }
  };

  const handleTeamClick = (team: Team) => {
    setSelectedTeam(team);
    fetchCompletedAssignments(team.id);
  };

  const handleAssignmentClick = async (assignmentId: number) => {
    if (!selectedTeam || !config) return;
    
    const finalPoints = config.double_points_active ? 2 : 1;
    
    await supabase.from('scores').insert([{
      team_id: selectedTeam.id,
      assignment_id: assignmentId,
      points: finalPoints,
      game_session_id: config.game_session_id,
    }]);
    
    setSelectedTeam(null);
    setCompletedAssignments([]);
    fetchData(); // Refresh scores
  };

  const toggleDoublePoints = async () => {
    if (!config) return;
    
    const { error } = await supabase
      .from('config')
      .update({ double_points_active: !config.double_points_active })
      .eq('id', config.id);
    
    if (!error) {
      setConfig({ ...config, double_points_active: !config.double_points_active });
    }
  };

  const setTimer = async () => {
    const minutes = parseInt(timerInput);
    if (isNaN(minutes) || minutes < 0) return;
    
    const seconds = minutes * 60;
    await supabase
      .from('config')
      .update({ 
        timer_duration: seconds,
        timer_is_running: false,
        timer_start_time: null
      })
      .eq('id', config?.id);
    
    setTimerInput('');
    fetchData();
  };

  const startTimer = async () => {
    if (!config) return;
    
    await supabase
      .from('config')
      .update({ 
        timer_is_running: true,
        timer_start_time: new Date().toISOString()
      })
      .eq('id', config.id);
    
    fetchData();
  };

  const stopTimer = async () => {
    if (!config) return;
    
    await supabase
      .from('config')
      .update({ timer_is_running: false })
      .eq('id', config.id);
    
    fetchData();
  };

  const handleCreativityPoints = async () => {
    if (!creativityTeam || !creativityAssignment || !config) return;
    
    const assignmentId = parseInt(creativityAssignment);
    if (isNaN(assignmentId) || assignmentId < 1 || assignmentId > 88) return;
    
    await supabase.from('scores').insert([{
      team_id: creativityTeam.id,
      assignment_id: assignmentId,
      points: 5, // Creativity bonus
      game_session_id: config.game_session_id,
    }]);
    
    setShowCreativityModal(false);
    setCreativityTeam(null);
    setCreativityAssignment('');
    fetchData();
  };

  const resetGame = async () => {
    if (!confirm('Weet je zeker dat je het spel wilt resetten? Alle huidige data blijft bewaard maar er start een nieuw spel.')) return;
    
    const newSessionId = crypto.randomUUID();
    await supabase
      .from('config')
      .update({
        game_session_id: newSessionId,
        timer_is_running: false,
        timer_start_time: null,
        timer_duration: 0
      })
      .eq('id', config?.id);
    
    fetchData();
    setSelectedTeam(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const teamsByCategory = (category: string) => 
    teams.filter(t => t.category === category);

  if (!config) return <div>Laden...</div>;

  return (
    <div>
      <div className="admin-controls">
        <h2>🎯 Jury/Admin Controls</h2>
        
        <div className="timer-section">
          <h3>⏰ Timer</h3>
          <div className="timer-display">
            {config.timer_duration > 0 && (
              <span className="timer-time">
                {formatTime(config.timer_is_running ? currentTime : config.timer_duration)}
              </span>
            )}
          </div>
          <div className="timer-controls">
            <input
              type="number"
              placeholder="Minuten"
              value={timerInput}
              onChange={(e) => setTimerInput(e.target.value)}
            />
            <button onClick={setTimer}>Tijd instellen</button>
            <button onClick={startTimer} disabled={!config.timer_duration || config.timer_is_running}>
              Start
            </button>
            <button onClick={stopTimer} disabled={!config.timer_is_running}>
              Stop
            </button>
          </div>
        </div>

        <div className="game-controls">
          <button className={`toggle ${config.double_points_active ? 'active' : ''}`} onClick={toggleDoublePoints}>
            🔁 Dubbele punten {config.double_points_active ? 'AAN' : 'UIT'}
          </button>
          <button className="creativity" onClick={() => setShowCreativityModal(true)}>
            🎨 Creativiteitspunten
          </button>
          <button className="reset" onClick={resetGame}>
            🔄 Nieuw Spel Starten
          </button>
        </div>
      </div>

      {!selectedTeam ? (
        <>
          <h2>👥 Kies team</h2>
          {['AVFV', 'MR', 'JEM'].map(category => (
            <div key={category}>
              <h3>{category}</h3>
              <div className="team-grid">
                {teamsByCategory(category).map(team => (
                  <button key={team.id} onClick={() => handleTeamClick(team)}>
                    ⭐ {team.name} ({teamScores[team.id] || 0} punten)
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <h2>📋 Kies opdracht voor {selectedTeam.name}</h2>
          <div className="grid">
            {Array.from({ length: 88 }, (_, i) => {
              const assignmentId = i + 1;
              const isCompleted = completedAssignments.includes(assignmentId);
              return (
                <button
                  key={assignmentId}
                  onClick={() => handleAssignmentClick(assignmentId)}
                  disabled={isCompleted}
                  className={isCompleted ? 'completed' : ''}
                >
                  #{assignmentId}
                </button>
              );
            })}
          </div>
          <button className="cancel" onClick={() => setSelectedTeam(null)}>
            ← Terug
          </button>
        </>
      )}

      {/* Creativity Modal */}
      {showCreativityModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>🎨 Creativiteitspunten Toekennen</h3>
            <p>Geef 5 punten voor een extra creatieve uitvoering</p>
            
            <div className="modal-form">
              <label>Team:</label>
              <select 
                value={creativityTeam?.id || ''} 
                onChange={(e) => {
                  const team = teams.find(t => t.id === e.target.value);
                  setCreativityTeam(team || null);
                }}
              >
                <option value="">Kies een team...</option>
                {['AVFV', 'MR', 'JEM'].map(category => (
                  <optgroup key={category} label={category}>
                    {teamsByCategory(category).map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({teamScores[team.id] || 0} punten)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <label>Opdracht nummer:</label>
              <input
                type="number"
                min="1"
                max="88"
                placeholder="1-88"
                value={creativityAssignment}
                onChange={(e) => setCreativityAssignment(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button 
                onClick={handleCreativityPoints}
                disabled={!creativityTeam || !creativityAssignment}
                className="confirm"
              >
                ✅ 5 Punten Toekennen
              </button>
              <button 
                onClick={() => {
                  setShowCreativityModal(false);
                  setCreativityTeam(null);
                  setCreativityAssignment('');
                }}
                className="cancel"
              >
                ❌ Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;