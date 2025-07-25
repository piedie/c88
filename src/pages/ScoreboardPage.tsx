import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  const [categoryStats, setCategoryStats] = useState<{[key: string]: {total: number, teams: number, average: number}}>({});
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [uniqueAssignments, setUniqueAssignments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref to track the latest fetch request
  const latestFetchRef = useRef<number>(0);

  // Optimized data fetching with race condition protection
  const fetchData = useCallback(async () => {
    const requestId = Date.now();
    latestFetchRef.current = requestId;
    
    try {
      const { data: configData } = await supabase.from('config').select('*').single();
      
      // Check if this is still the latest request
      if (latestFetchRef.current !== requestId) return;
      
      if (configData) {
        setConfig(prevConfig => {
          if (JSON.stringify(prevConfig) === JSON.stringify(configData)) {
            return prevConfig;
          }
          return configData;
        });
      }

      if (!configData) {
        setIsLoading(false);
        return;
      }

      // Get teams with scores in one query for consistency
      const { data: scoreData } = await supabase
        .from('scores')
        .select(`
          team_id,
          assignment_id,
          points,
          created_at,
          teams!inner(name, category)
        `)
        .eq('game_session_id', configData.game_session_id)
        .order('created_at', { ascending: false });

      // Check again if this is still the latest request
      if (latestFetchRef.current !== requestId) return;

      // Process team statistics
      const teamStats: {[key: string]: Team} = {};
      const assignmentCounts: {[key: number]: number} = {};
      const uniqueAssignmentIds = new Set<number>();
      let totalAssignmentsCount = 0;
      
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
        totalAssignmentsCount++;
        
        if (score.points === 5) {
          teamStats[teamId].creativity_points += score.points;
        } else {
          teamStats[teamId].normal_points += score.points;
        }
        
        assignmentCounts[score.assignment_id] = (assignmentCounts[score.assignment_id] || 0) + 1;
      });

      // Sort teams with improved stability
      const teamsArray = Object.values(teamStats).sort((a, b) => {
        // Primary: total points (descending)
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        // Secondary: assignments completed (descending) 
        if (b.assignments_completed !== a.assignments_completed) {
          return b.assignments_completed - a.assignments_completed;
        }
        // Tertiary: creativity points (descending)
        if (b.creativity_points !== a.creativity_points) {
          return b.creativity_points - a.creativity_points;
        }
        // Final: name for consistent ordering
        return a.name.localeCompare(b.name);
      });

      // Process other data
      const recent: RecentActivity[] = scoreData?.slice(0, 10).map(score => ({
        assignment_id: score.assignment_id,
        team_name: (score.teams as any).name,
        team_category: (score.teams as any).category,
        points: score.points,
        created_at: score.created_at,
      })) || [];

      const popular = Object.entries(assignmentCounts)
        .map(([id, count]) => ({ assignment_id: parseInt(id), completion_count: count }))
        .sort((a, b) => b.completion_count - a.completion_count)
        .slice(0, 5);

      // Calculate category stats
      const catStats: {[key: string]: {total: number, teams: number, average: number}} = {};
      teamsArray.forEach(team => {
        if (!catStats[team.category]) {
          catStats[team.category] = {total: 0, teams: 0, average: 0};
        }
        catStats[team.category].total += team.total_points;
        catStats[team.category].teams += 1;
      });
      
      Object.keys(catStats).forEach(category => {
        catStats[category].average = catStats[category].total / catStats[category].teams;
      });

      // Final check before updating state
      if (latestFetchRef.current !== requestId) return;

      // Update all state with functional updates to prevent race conditions
      setTeams(prevTeams => {
        const newTeamsString = JSON.stringify(teamsArray);
        const prevTeamsString = JSON.stringify(prevTeams);
        return newTeamsString === prevTeamsString ? prevTeams : teamsArray;
      });
      
      setRecentActivity(prevActivity => {
        const newActivityString = JSON.stringify(recent);
        const prevActivityString = JSON.stringify(prevActivity);
        return newActivityString === prevActivityString ? prevActivity : recent;
      });
      
      setPopularAssignments(prevPopular => {
        const newPopularString = JSON.stringify(popular);
        const prevPopularString = JSON.stringify(prevPopular);
        return newPopularString === prevPopularString ? prevPopular : popular;
      });
      
      setCategoryStats(prevStats => {
        const newStatsString = JSON.stringify(catStats);
        const prevStatsString = JSON.stringify(prevStats);
        return newStatsString === prevStatsString ? prevStats : catStats;
      });

      // Update simple values
      setTotalAssignments(prev => prev === totalAssignmentsCount ? prev : totalAssignmentsCount);
      setUniqueAssignments(prev => prev === uniqueAssignmentIds.size ? prev : uniqueAssignmentIds.size);
      setIsLoading(false);

    } catch (error) {
      console.error('Error fetching scoreboard data:', error);
      if (latestFetchRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  // Timer update function
  const updateTimer = useCallback(() => {
    if (!config) return;
    
    if (config.timer_is_running && config.timer_start_time) {
      const startTime = new Date(config.timer_start_time).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, config.timer_duration - elapsed);
      setCurrentTime(remaining);
    } else if (config.timer_start_time) {
      const startTime = new Date(config.timer_start_time).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, config.timer_duration - elapsed);
      setCurrentTime(remaining);
    } else {
      setCurrentTime(config.timer_duration || 0);
    }
  }, [config]);

  // Effects
  useEffect(() => {
    fetchData();
    
    const dataInterval = setInterval(fetchData, 15000);
    
    return () => {
      clearInterval(dataInterval);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!config) return;
    
    const timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call
    
    return () => {
      clearInterval(timerInterval);
    };
  }, [config, updateTimer]);

  // Helper functions
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerStatus = () => {
    if (!config?.timer_duration) return 'Geen timer ingesteld';
    if (!config.timer_start_time) return 'Klaar om te starten';
    
    if (config.timer_start_time) {
      const startTime = new Date(config.timer_start_time).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, config.timer_duration - elapsed);
      
      if (remaining <= 0) return '🏁 Het spel is afgelopen!';
    }
    
    if (config.timer_is_running) return '🔥 Spel loopt!';
    return '⏸️ Spel gepauzeerd';
  };

  const getTopTeamByCategory = (category: string) => {
    return teams.filter(t => t.category === category)[0];
  };

  const getBestCreativityTeam = () => {
    return [...teams].sort((a, b) => b.creativity_points - a.creativity_points)[0];
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

  const getMomentumLeader = () => {
    if (!config?.timer_start_time) return null;
    
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

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'AVFV': return 'AV/Fotograaf';
      case 'MR': return 'Mediaredactie';
      case 'JEM': return 'Junior Event Manager';
      default: return category;
    }
  };

  if (isLoading || !config) {
    return <div className="loading">Laden...</div>;
  }

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
          {config.timer_duration > 0 ? formatTime(currentTime) : '--:--'}
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
            <div key={`${team.id}-${team.total_points}`} className={`rank-card rank-${index + 1}`}>
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

      {/* Enhanced Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>👑 Opleiding leiders</h3>
          {['AVFV', 'MR', 'JEM'].map(category => {
            const leader = getTopTeamByCategory(category);
            return (
              <div key={category} className="category-leader">
                <span className="category-name">{getCategoryName(category)}</span>
                <span className="leader-info">
                  {leader ? `${leader.name} (${leader.total_points} punten)` : 'Geen teams'}
                </span>
              </div>
            );
          })}
        </div>

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
          <h3>🎨 Meest creatief</h3>
          {(() => {
            const creativityLeader = getBestCreativityTeam();
            return creativityLeader && creativityLeader.creativity_points > 0 ? (
              <div className="creativity-leader">
                <div className="leader-name">{creativityLeader.name}</div>
                <div className="creativity-score">{creativityLeader.creativity_points} creativiteitspunten</div>
              </div>
            ) : (
              <div className="no-data">Nog geen creativiteitspunten</div>
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
          <h3>📊 Opleiding prestaties (gemiddeld)</h3>
          {Object.entries(categoryStats)
            .sort(([,a], [,b]) => b.average - a.average)
            .map(([category, stats]) => (
              <div key={category} className="category-total">
                <span className="category-name">{getCategoryName(category)}</span>
                <span className="category-points">
                  {stats.average.toFixed(1)} gem. ({stats.teams} teams)
                </span>
              </div>
            ))}
        </div>

        <div className="stat-card">
          <h3>🏆 Opleiding totalen (absoluut)</h3>
          {Object.entries(categoryStats)
            .sort(([,a], [,b]) => b.total - a.total)
            .map(([category, stats]) => (
              <div key={category} className="category-total">
                <span className="category-name">{getCategoryName(category)}</span>
                <span className="category-points">{stats.total} punten</span>
              </div>
            ))}
        </div>

        <div className="stat-card">
          <h3>🔥 Populairste opdrachten</h3>
          {popularAssignments.length > 0 ? popularAssignments.slice(0, 5).map((assignment, index) => (
            <div key={assignment.assignment_id} className="popular-assignment">
              <span className="assignment-rank">#{index + 1}</span>
              <span className="assignment-number">Opdracht {assignment.assignment_id}</span>
              <span className="completion-count">{assignment.completion_count}× gedaan</span>
            </div>
          )) : (
            <div className="no-data">Nog geen opdrachten voltooid</div>
          )}
        </div>

        <div className="stat-card">
          <h3>⚡ Live activiteit</h3>
          <div className="recent-activity">
            {recentActivity.length > 0 ? recentActivity.slice(0, 5).map((activity, index) => (
              <div key={`${activity.team_name}-${activity.assignment_id}-${activity.created_at}`} className="activity-item">
                <span className="activity-emoji">{getPointTypeEmoji(activity.points)}</span>
                <span className="activity-text">
                  <strong>{activity.team_name}</strong> deed opdracht {activity.assignment_id}
                </span>
                <span className="activity-time">{formatTimeAgo(activity.created_at)}</span>
              </div>
            )) : (
              <div className="no-data">Nog geen activiteit</div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3>📝 Nog te doen</h3>
          <div className="uncompleted-assignments">
            {(() => {
              const uncompleted = getUncompletedAssignments();
              return uncompleted.length > 0 ? (
                <>
                  <div className="uncompleted-list">
                    {uncompleted.map(id => (
                      <span key={id} className="uncompleted-number">#{id}</span>
                    ))}
                  </div>
                  {uncompleted.length >= 10 && (
                    <div className="uncompleted-summary">En nog meer...</div>
                  )}
                </>
              ) : (
                <div className="no-data">Alle opdrachten gedaan! 🎉</div>
              );
            })()}
          </div>
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