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
  const [teamScores, setTeamScores] = useState<{[key: string]: number}>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [pausedTime, setPausedTime] = useState(0);
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

  const pauseTimer = async () => {
    if (!config) return;
    
    // Calculate how much time has elapsed and store it
    const startTime = new Date(config.timer_start_time!).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - startTime) / 1000);
    const remaining = Math.max(0, config.timer_duration - elapsed);
    
    await supabase
      .from('config')
      .update({ 
        timer_is_running: false,
        timer_duration: remaining // Store remaining time
      })
      .eq('id', config.id);
    
    fetchData();
  };

  const resumeTimer = async () => {
    if (!config) return;
    
    await supabase
      .from('config')
      .update({ 
        timer_is_running: true,
        timer_start_time: new Date().toISOString()
        // timer_duration stays the same (remaining time from pause)
      })
      .eq('id', config.id);
    
    fetchData();
  };

  const stopTimer = async () => {
    if (!config) return;
    
    await supabase
      .from('config')
      .update({ 
        timer_is_running: false,
        timer_start_time: null,
        timer_duration: 0 // Full reset
      })
      .eq('id', config.id);
    
    fetchData();
  };

  const handleCreativityPoints = async () => {
    if (!creativityTeam || !creativityAssignment || !config) return;
    
    const assignmentId = parseInt(creativityAssignment);
    if (isNaN(assignmentId) || assignmentId < 1 || assignmentId > 88) return;
    
    // Check if this team already has points for this assignment
    const { data: existingScores } = await supabase
      .from('scores')
      .select('*')
      .eq('team_id', creativityTeam.id)
      .eq('assignment_id', assignmentId)
      .eq('game_session_id', config.game_session_id);
    
    if (existingScores && existingScores.length > 0) {
      alert(`Team "${creativityTeam.name}" heeft al punten voor opdracht ${assignmentId}. Creativiteitspunten kunnen niet worden toegevoegd aan reeds voltooide opdrachten.`);
      return;
    }
    
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
    const keepTeams = confirm('Wil je de teams behouden?\n\n✅ JA = Teams blijven, scores worden gewist\n❌ NEE = Alles wordt gewist (teams én scores)');
    
    if (!confirm(`${keepTeams ? 'Teams behouden en' : 'Alles wissen en'} nieuw spel starten?`)) return;
    
    const newSessionId = crypto.randomUUID();
    
    if (keepTeams && config) {
      // Keep teams but reset their session ID
      await supabase
        .from('teams')
        .update({ game_session_id: newSessionId })
        .eq('game_session_id', config.game_session_id);
    }
    
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

  // Game state logic
  const getGameState = () => {
    if (!config?.timer_duration) return 'setup'; // No timer set
    if (config.timer_is_running) return 'running'; // Game is running
    if (!config.timer_is_running && config.timer_start_time) {
      // Game has been started before, check if within grace period
      const startTime = new Date(config.timer_start_time).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, config.timer_duration - elapsed);
      
      if (remaining > 0) return 'paused'; // Game paused but time left
      
      // Game finished, check grace period (5 minutes = 300 seconds)
      const graceElapsed = elapsed - config.timer_duration;
      if (graceElapsed <= 300) return 'grace'; // Within 5 min grace period
      return 'finished'; // Grace period over
    }
    return 'ready'; // Timer set but never started
  };

  const gameState = getGameState();
  const canAssignPoints = gameState === 'running' || gameState === 'paused' || gameState === 'grace';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGameStateMessage = () => {
    switch (gameState) {
      case 'setup': return '⚙️ Stel eerst een timer in';
      case 'ready': return '⏳ Klaar om te starten';
      case 'running': return '🔥 Spel loopt!';
      case 'paused': return '⏸️ Spel gepauzeerd';
      case 'grace': return '⚡ Graceperiode (nog 5 min om punten bij te werken)';
      case 'finished': return '🏁 Spel afgelopen - geen punten meer mogelijk';
      default: return '';
    }
  };

  const getFullCategoryName = (category: string) => {
    switch (category) {
      case 'JEM': return 'Junior Event Manager';
      case 'MR': return 'Mediaredactie';  
      case 'AVFV': return 'AV/Fotograaf';
      default: return category;
    }
  };

  const teamsByCategory = (category: string) => 
    teams.filter(t => t.category === category);

  if (!config) return <div>Laden...</div>;

  return (
    <div className="admin-layout">
      <div className="main-content">
        {!selectedTeam ? (
          <>
            <h2>👥 Kies team</h2>
            <div className="team-categories">
              {['AVFV', 'MR', 'JEM'].map(category => (
                <div key={category} className="team-category-column">
                  <h3>{getFullCategoryName(category)}</h3>
                  <div className="team-column">
                    {teamsByCategory(category).map(team => (
                      <button 
                        key={team.id} 
                        onClick={() => handleTeamClick(team)}
                        disabled={!canAssignPoints}
                      >
                        ⭐ {team.name} ({teamScores[team.id] || 0} punten)
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
      </div>

      <div className="admin-controls">
        <h2>🎯 Jury controls</h2>
        
        <div className="timer-section">
          <h3>⏰ Timer</h3>
          <div className="timer-display">
            {config.timer_duration > 0 && (
              <span className="timer-time">
                {formatTime(config.timer_is_running ? currentTime : config.timer_duration)}
              </span>
            )}
            <div className={`game-state game-state-${gameState}`}>
              {getGameStateMessage()}
            </div>
          </div>
          <div className="timer-controls">
            <input
              type="number"
              placeholder="Minuten"
              value={timerInput}
              onChange={(e) => setTimerInput(e.target.value)}
              disabled={config.timer_is_running}
            />
            <button onClick={setTimer} disabled={config.timer_is_running}>Tijd instellen</button>
            <button onClick={startTimer} disabled={!config.timer_duration || config.timer_is_running}>
              Start
            </button>
            <button onClick={pauseTimer} disabled={!config.timer_is_running}>
              ⏸️ Pauze
            </button>
            <button onClick={resumeTimer} disabled={config.timer_is_running || !config.timer_start_time}>
              ▶️ Hervat
            </button>
            <button onClick={stopTimer} disabled={!config.timer_duration && !config.timer_start_time}>
              ⏹️ Stop
            </button>
          </div>
        </div>

        <div className="game-controls">
          <button className={`toggle ${config.double_points_active ? 'active' : ''}`} onClick={toggleDoublePoints}>
            🔁 Dubbele punten {config.double_points_active ? 'AAN' : 'UIT'}
          </button>
          <button className="creativity" onClick={() => setShowCreativityModal(true)} disabled={!canAssignPoints}>
            🎨 Creativiteitspunten
          </button>
          <button className="reset" onClick={resetGame}>
            🔄 Nieuw spel starten
          </button>
        </div>
      </div>

      {/* Creativity Modal */}
      {showCreativityModal && (
        <div className="modal-overlay" onClick={() => setShowCreativityModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                {teams && teams.length > 0 && ['AVFV', 'MR', 'JEM'].map(category => {
                  const categoryTeams = teamsByCategory(category);
                  if (categoryTeams.length === 0) return null;
                  return (
                    <optgroup key={category} label={category}>
                      {categoryTeams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({teamScores[team.id] || 0} punten)
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
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
                disabled={!creativityTeam || !creativityAssignment || !canAssignPoints}
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