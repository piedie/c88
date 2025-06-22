import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
  total_points: number;
  assignments_completed: number;
  avg_time_between?: number;
  creativity_points: number;
  normal_points: number;
}

interface Config {
  timer_duration: number;
  timer_start_time: string | null;
  timer_is_running: boolean;
  game_session_id: string;
  announcement_text?: string;
  announcement_timestamp?: string;
}

interface PopularAssignment {
  assignment_id: number;
  completion_count: number;
}

const ScoreboardPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [popularAssignments, setPopularAssignments] = useState<PopularAssignment[]>([]);
  const [categoryStats, setCategoryStats] = useState<{[key: string]: {total: number, teams: number, average: number}}>({});
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [uniqueAssignments, setUniqueAssignments] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    
    // Timer updates every second for smooth countdown
    const timerInterval = setInterval(() => {
      updateTimer();
    }, 1000);
    
    // Data refresh every 10 seconds (announcements, scores, etc.)
    const dataInterval = setInterval(() => {
      fetchData();
    }, 10000);
    
    return () => {
      clearInterval(timerInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const fetchData = async () => {
    const { data: configData } = await supabase.from('config').select('*').single();
    
    if (configData) {
      setConfig(configData);
      
      // Update timer data separately for smooth updates
      setTimerData({
        duration: configData.timer_duration || 0,
        startTime: configData.timer_start_time,
        isRunning: configData.timer_is_running || false
      });
      
      // Calculate initial timer value
      if (configData.timer_is_running && configData.timer_start_time) {
        const startTime = new Date(configData.timer_start_time).getTime();
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, configData.timer_duration - elapsed);
        setCurrentTime(remaining);
      } else if (configData.timer_start_time) {
        const startTime = new Date(configData.timer_start_time).getTime();
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, configData.timer_duration - elapsed);
        setCurrentTime(remaining);
      } else {
        setCurrentTime(configData.timer_duration || 0);
      }
    }

    if (!configData) return;

    // Get teams with scores
    const { data: scoreData } = await supabase
      .from('scores')
      .select(`
        team_id,
        assignment_id,
        points,
        created_at,
        teams!inner(name, category)
      `)
      .eq('game_session_id', configData.game_session_id);

    // Process team statistics
    const teamStats: {[key: string]: Team} = {};
    const assignmentCounts: {[key: number]: number} = {};
    const uniqueAssignmentIds = new Set<number>();
    
    scoreData?.forEach(score => {
      const teamId = score.team_id;
      const team = (score.teams as any);
      
      if (!teamStats[teamId]) {
        teamStats[teamId] = {
          id: teamId,
          name: team.name,
          category: team.category,
          total_points: 0,
          assignments_completed: 0,
          creativity_points: 0,
          normal_points: 0,
        };
      }
      
      teamStats[teamId].total_points += score.points;
      teamStats[teamId].assignments_completed += 1;
      uniqueAssignmentIds.add(score.assignment_id);
      
      if (score.points === 5) {
        teamStats[teamId].creativity_points += score.points;
      } else {
        teamStats[teamId].normal_points += score.points;
      }
      
      // Count popular assignments
      assignmentCounts[score.assignment_id] = (assignmentCounts[score.assignment_id] || 0) + 1;
    });

    const teamsArray = Object.values(teamStats).sort((a, b) => b.total_points - a.total_points);
    setTeams(teamsArray);
    setTotalAssignments(scoreData?.length || 0);
    setUniqueAssignments(uniqueAssignmentIds.size);

    // Recent activity (last 10)
    const recent = scoreData?.slice(-10).reverse().map(score => ({
      assignment_id: score.assignment_id,
      team_name: (score.teams as any).name,
      team_category: (score.teams as any).category,
      points: score.points,
      created_at: score.created_at,
    })) || [];
    setRecentActivity(recent);

    // Popular assignments
    const popular = Object.entries(assignmentCounts)
      .map(([id, count]) => ({ assignment_id: parseInt(id), completion_count: count }))
      .sort((a, b) => b.completion_count - a.completion_count)
      .slice(0, 5);
    setPopularAssignments(popular);

    // Category stats - weighted by team count
    const catStats: {[key: string]: {total: number, teams: number, average: number}} = {};
    teamsArray.forEach(team => {
      if (!catStats[team.category]) {
        catStats[team.category] = {total: 0, teams: 0, average: 0};
      }
      catStats[team.category].total += team.total_points;
      catStats[team.category].teams += 1;
    });
    
    // Calculate averages
    Object.keys(catStats).forEach(category => {
      catStats[category].average = catStats[category].total / catStats[category].teams;
    });
    
    setCategoryStats(catStats);
  };

  const updateTimer = () => {
    if (timerData.isRunning && timerData.startTime) {
      const startTime = new Date(timerData.startTime).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerData.duration - elapsed);
      setCurrentTime(remaining);
    } else if (timerData.startTime) {
      // Timer was started but is now stopped/paused - calculate remaining time
      const startTime = new Date(timerData.startTime).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerData.duration - elapsed);
      setCurrentTime(remaining);
    } else {
      // Timer never started - show full duration
      setCurrentTime(timerData.duration || 0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerStatus = () => {
    if (!timerData.duration) return 'Geen timer ingesteld';
    if (!timerData.startTime) return 'Klaar om te starten';
    
    // Check if time is up
    if (timerData.startTime) {
      const startTime = new Date(timerData.startTime).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerData.duration - elapsed);
      
      if (remaining <= 0) return '🏁 Het spel is afgelopen!';
    }
    
    if (timerData.isRunning) return '🔥 Spel loopt!';
    return '⏸️ Spel gepauzeerd';
  };

  const getTopTeamByCategory = (category: string) => {
    return teams.filter(t => t.category === category)[0];
  };

  const getBestCreativityTeam = () => {
    return teams.sort((a, b) => b.creativity_points - a.creativity_points)[0];
  };

  const getGameDuration = () => {
    if (!config?.timer_start_time) return 0;
    const startTime = new Date(config.timer_start_time).getTime();
    const now = new Date().getTime();
    const minutes = Math.floor((now - startTime) / (1000 * 60));
    return Math.max(0, minutes);
  };

  const getRecentActivity = (minutes: number) => {
    if (!config?.timer_start_time) return [];
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return recentActivity.filter(activity => new Date(activity.created_at) > cutoff);
  };

  const getFastestTeam = () => {
    if (!config?.timer_start_time || teams.length === 0) return null;
    const gameStartTime = new Date(config.timer_start_time).getTime();
    const now = new Date().getTime();
    const minutesElapsed = Math.max(1, (now - gameStartTime) / (1000 * 60));
    
    return teams
      .filter(t => t.assignments_completed > 0)
      .map(t => ({...t, rate: t.assignments_completed / minutesElapsed}))
      .sort((a, b) => b.rate - a.rate)[0];
  };

  const getUncompletedAssignments = () => {
    const completed = new Set();
    recentActivity.forEach(activity => completed.add(activity.assignment_id));
    popularAssignments.forEach(assignment => completed.add(assignment.assignment_id));
    
    const uncompleted = [];
    for (let i = 1; i <= 88; i++) {
      if (!completed.has(i)) uncompleted.push(i);
    }
    return uncompleted.slice(0, 10);
  };

  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60));
    if (minutes < 1) return 'zojuist';
    if (minutes < 60) return `${minutes}m geleden`;
    return `${Math.floor(minutes / 60)}u geleden`;
  };

  const getPointTypeEmoji = (points: number) => {
    if (points === 5) return '🎨';
    if (points === 2) return '🔁';
    return '⭐';
  };

  const getMomentumLeader = () => {
    if (!config?.timer_start_time) return null;
    
    // Get activity from last 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentTeamActivity: {[key: string]: number} = {};
    
    recentActivity.forEach(activity => {
      if (new Date(activity.created_at) > fifteenMinAgo) {
        recentTeamActivity[activity.team_name] = (recentTeamActivity[activity.team_name] || 0) + 1;
      }
    });
    
    const sorted = Object.entries(recentTeamActivity).sort(([,a], [,b]) => b - a);
    return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
  };

  const exportToPDF = () => {
    const printContent = `
      CRAZY 88 - EINDRESULTATEN
      
      🏆 TEAM RANKINGS:
      ${teams.slice(0, 10).map((team, i) => `${i+1}. ${team.name} (${team.category}) - ${team.total_points} punten`).join('\n')}
      
      📊 OPLEIDING PRESTATIES:
      ${Object.entries(categoryStats).sort(([,a], [,b]) => b.average - a.average).map(([cat, stats]) => `${cat}: ${stats.average.toFixed(1)} gemiddeld (${stats.teams} teams)`).join('\n')}
      
      🔥 POPULAIRSTE OPDRACHTEN:
      ${popularAssignments.slice(0, 5).map((a, i) => `${i+1}. Opdracht ${a.assignment_id} (${a.completion_count}× gedaan)`).join('\n')}
      
      📈 STATISTIEKEN:
      - Totaal opdrachten: ${totalAssignments}
      - Unieke opdrachten: ${uniqueAssignments}/88
      - Speeltijd: ${getGameDuration()} minuten
    `;
    
    const blob = new Blob([printContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crazy88-resultaten.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!config) return <div className="loading">Laden...</div>;

  return (
    <div className="scoreboard">
      {/* Live Announcement */}
      {config.announcement_text && (
        <div className="live-announcement">
          📢 {config.announcement_text}
        </div>
      )}

      {/* Timer Display */}
      <div className="timer-hero">
        <div className="timer-display-large">
          {timerData.duration > 0 ? formatTime(currentTime) : '--:--'}
        </div>
        <div className="timer-status">
          {getTimerStatus()}
        </div>
      </div>

      {/* Live Stats Banner */}
      <div className="live-stats-banner">
        <div className="live-stat">
          <span className="stat-number">{getGameDuration()}</span>
          <span className="stat-label">minuten bezig</span>
        </div>
        <div className="live-stat">
          <span className="stat-number">{getRecentActivity(10).length}</span>
          <span className="stat-label">opdrachten laatste 10 min</span>
        </div>
        <div className="live-stat">
          <span className="stat-number">{totalAssignments}</span>
          <span className="stat-label">opdrachten gedaan!</span>
        </div>
        <div className="live-stat">
          <span className="stat-number">{uniqueAssignments}</span>
          <span className="stat-label">van de 88 unieke opdrachten</span>
        </div>
      </div>

      {/* Main Rankings */}
      <div className="rankings-section">
        <h2>🏆 Team rankings</h2>
        <div className="rankings-grid">
          {teams.slice(0, 10).map((team, index) => (
            <div key={team.id} className={`rank-card rank-${index + 1}`}>
              <div className="rank-number">#{index + 1}</div>
              <div className="team-info">
                <div className="team-name">{team.name}</div>
                <div className="team-category">{team.category}</div>
              </div>
              <div className="team-score">{team.total_points}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Leaders */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>🚀 Snelste team</h3>
          {(() => {
            const fastest = getFastestTeam();
            return fastest ? (
              <div className="fastest-team">
                <div className="team-name">{fastest.name}</div>
                <div className="team-rate">{fastest.rate.toFixed(1)} opdrachten/minuut</div>
                <div className="team-total">{fastest.assignments_completed} opdrachten gedaan</div>
              </div>
            ) : (
              <div className="no-data">Spel nog niet gestart</div>
            );
          })()}
        </div>

        <div className="stat-card">
          <h3>🔥 Momentum meter</h3>
          {(() => {
            const momentum = getMomentumLeader();
            return momentum ? (
              <div className="momentum-leader">
                <div className="momentum-team">{momentum.name}</div>
                <div className="momentum-score">{momentum.count} opdrachten laatste 15 min</div>
                <div className="momentum-badge">🚀 Hot streak!</div>
              </div>
            ) : (
              <div className="no-data">Geen recente activiteit</div>
            );
          })()}
        </div>

        <div className="stat-card">
          <h3>👑 Opleiding leiders</h3>
          {['AVFV', 'MR', 'JEM'].map(category => {
            const leader = getTopTeamByCategory(category);
            return (
              <div key={category} className="category-leader">
                <span className="category-name">{category}</span>
                <span className="leader-info">
                  {leader ? `${leader.name} (${leader.total_points} punten)` : 'Geen teams'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="stat-card">
          <h3>🎨 Meest creatief</h3>
          {(() => {
            const creativityLeader = getBestCreativityTeam();
            return creativityLeader && creativityLeader.creativity_points > 0 ? (
              <div className="creativity-leader">
                <div className="leader-name">{creativityLeader.name}</div>
                <div className="creativity-score">{creativityLeader.creativity_points} creativiteitspunten</div>
              </div>
            ) : (
              <div className="no-data">Nog geen creativiteitspunten toegekend</div>
            );
          })()}
        </div>

        <div className="stat-card">
          <h3>📊 Opleiding prestaties (gemiddeld)</h3>
          {Object.entries(categoryStats)
            .sort(([,a], [,b]) => b.average - a.average)
            .map(([category, stats]) => {
              const categoryName = category === 'AVFV' ? 'AV/Fotograaf' : 
                                 category === 'MR' ? 'Mediaredactie' : 'Junior Event Manager';
              return (
                <div key={category} className="category-total">
                  <span className="category-name">{categoryName}</span>
                  <span className="category-points">
                    {stats.average.toFixed(1)} gem. ({stats.teams} teams)
                  </span>
                </div>
              );
            })}
        </div>

        <div className="stat-card">
          <h3>🏆 Opleiding totalen (absoluut)</h3>
          {Object.entries(categoryStats)
            .sort(([,a], [,b]) => b.total - a.total)
            .map(([category, stats]) => {
              const categoryName = category === 'AVFV' ? 'AV/Fotograaf' : 
                                 category === 'MR' ? 'Mediaredactie' : 'Junior Event Manager';
              return (
                <div key={category} className="category-total">
                  <span className="category-name">{categoryName}</span>
                  <span className="category-points">{stats.total} punten</span>
                </div>
              );
            })}
        </div>

        <div className="stat-card">
          <h3>🔥 Populairste opdrachten</h3>
          {popularAssignments.length > 0 ? popularAssignments.map((assignment, index) => (
            <div key={assignment.assignment_id} className="popular-assignment">
              <span className="assignment-rank">#{index + 1}</span>
              <span className="assignment-number">Opdracht {assignment.assignment_id}</span>
              <span className="completion-count">{assignment.completion_count}× voltooid</span>
            </div>
          )) : (
            <div className="no-data">Nog geen opdrachten voltooid</div>
          )}
        </div>
      </div>

      {teams.length === 0 && (
        <div className="no-teams-message">
          <h3>🎯 Klaar voor de start!</h3>
          <p>Nog geen scores. Het spel kan beginnen!</p>
        </div>
      )}

      {/* Export Button */}
      <div className="export-section">
        <button onClick={exportToPDF} className="export-btn">
          📄 Exporteer resultaten
        </button>
      </div>
    </div>
  );
};

export default ScoreboardPage; 