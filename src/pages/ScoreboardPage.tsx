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
}

interface PopularAssignment {
  assignment_id: number;
  completion_count: number;
}

interface RecentActivity {
  assignment_id: number;
  team_name: string;
  team_category: string;
  points: number;
  created_at: string;
}

const ScoreboardPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [popularAssignments, setPopularAssignments] = useState<PopularAssignment[]>([]);
  const [categoryStats, setCategoryStats] = useState<{[key: string]: number}>({});
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [uniqueAssignments, setUniqueAssignments] = useState(0);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(); // Fetch fresh data including timer state
      updateTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const { data: configData } = await supabase.from('config').select('*').single();
    
    if (configData) {
      setConfig(configData);
      
      // Immediately calculate timer value when we get fresh config
      if (configData.timer_is_running && configData.timer_start_time) {
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
    const recent: RecentActivity[] = scoreData?.slice(-10).reverse().map(score => ({
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

    // Category stats
    const catStats: {[key: string]: number} = {};
    teamsArray.forEach(team => {
      catStats[team.category] = (catStats[team.category] || 0) + team.total_points;
    });
    setCategoryStats(catStats);
  };

  const updateTimer = () => {
    if (!config) return;
    
    if (config.timer_is_running && config.timer_start_time) {
      const startTime = new Date(config.timer_start_time).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, config.timer_duration - elapsed);
      setCurrentTime(remaining);
    } else {
      setCurrentTime(config.timer_duration || 0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerStatus = () => {
    if (!config?.timer_duration) return 'Geen timer ingesteld';
    if (config.timer_is_running) return 'Spel loopt';
    if (currentTime <= 0) return 'Spel afgelopen';
    return 'Spel gepauzeerd';
  };

  const getTopTeamByCategory = (category: string) => {
    return teams.filter(t => t.category === category)[0];
  };

  const getBestCreativityTeam = () => {
    return teams.sort((a, b) => b.creativity_points - a.creativity_points)[0];
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
    // Also check popular assignments
    popularAssignments.forEach(assignment => completed.add(assignment.assignment_id));
    
    const uncompleted = [];
    for (let i = 1; i <= 88; i++) {
      if (!completed.has(i)) uncompleted.push(i);
    }
    return uncompleted.slice(0, 10); // Show first 10
  };

  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60));
    if (minutes < 1) return 'zojuist';
    if (minutes < 60) return `${minutes}m geleden`;
    return `${Math.floor(minutes / 60)}u geleden`;
  };

  const getGameDuration = () => {
    if (!config?.timer_start_time) return null;
    const startTime = new Date(config.timer_start_time).getTime();
    const now = new Date().getTime();
    const minutes = Math.floor((now - startTime) / (1000 * 60));
    return minutes;
  };

  const getRecentActivity = (minutes: number) => {
    if (!config?.timer_start_time) return [];
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return recentActivity.filter(activity => new Date(activity.created_at) > cutoff);
  };

  const getMostActiveTeam = () => {
    if (recentActivity.length === 0) return null;
    
    const teamCounts: {[key: string]: {name: string, count: number}} = {};
    recentActivity.forEach(activity => {
      if (!teamCounts[activity.team_name]) {
        teamCounts[activity.team_name] = {name: activity.team_name, count: 0};
      }
      teamCounts[activity.team_name].count++;
    });
    
    const sorted = Object.values(teamCounts).sort((a, b) => b.count - a.count);
    return sorted.length > 0 ? sorted[0] : null;
  };

  if (!config) return <div className="loading">Laden...</div>;

  return (
    <div className="scoreboard">
      {/* Timer Display */}
      <div className="timer-hero">
        <div className="timer-display-large">
          {config.timer_duration > 0 ? formatTime(currentTime) : '--:--'}
        </div>
        <div className="timer-status">
          {getTimerStatus()}
        </div>
      </div>

      {/* Live Stats Banner */}
      <div className="live-stats-banner">
        <div className="live-stat">
          <span className="stat-number">{gameDuration || 0}</span>
          <span className="stat-label">minuten bezig</span>
        </div>
        <div className="live-stat">
          <span className="stat-number">{recentTenMin.length}</span>
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
        <h2>🏆 Team Rankings</h2>
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
          <h3>⏱️ Tempo statistieken</h3>
          <div className="tempo-stats">
            <div className="tempo-item">
              <span className="tempo-label">Spel loopt al:</span>
              <span className="tempo-value">{gameDuration || 0} minuten</span>
            </div>
            <div className="tempo-item">
              <span className="tempo-label">Laatste 10 minuten:</span>
              <span className="tempo-value">{recentTenMin.length} opdrachten</span>
            </div>
            {mostActive && (
              <div className="tempo-item">
                <span className="tempo-label">Meest actieve team:</span>
                <span className="tempo-value">{mostActive.name} ({mostActive.count}× actief)</span>
              </div>
            )}
            <div className="tempo-item">
              <span className="tempo-label">Gemiddeld tempo:</span>
              <span className="tempo-value">
                {gameDuration ? (totalAssignments / gameDuration).toFixed(1) : '0'} opdrachten/min
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <h3>👑 Opleiding Leiders</h3>
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
          <h3>🎨 Meest Creatief</h3>
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
          <h3>📊 Opleiding Totalen</h3>
          {Object.entries(categoryStats)
            .sort(([,a], [,b]) => b - a)
            .map(([category, points]) => (
              <div key={category} className="category-total">
                <span className="category-name">{category}</span>
                <span className="category-points">{points} punten</span>
              </div>
            ))}
        </div>

        <div className="stat-card">
          <h3>🔥 Populairste Opdrachten</h3>
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
    </div>
  );
};

export default ScoreboardPage;