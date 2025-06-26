import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Submission {
  id: string;
  assignment_id: string;
  team_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  points_awarded: number;
  submitted_at: string;
  reviewed_at?: string;
  jury_notes?: string;
  photo_url?: string;
  video_url?: string;
  audio_url?: string;
  description?: string;
  file_type?: string;
  file_size?: number;
  // Joined data
  assignment_number?: number;
  assignment_title?: string;
  assignment_points_base?: number;
  team_name?: string;
  team_category?: string;
}

interface Config {
  double_points_active: boolean;
  game_session_id: string;
}

const JuryReviewInterface = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [juryNotes, setJuryNotes] = useState('');
  const [customPoints, setCustomPoints] = useState<number | null>(null);
  const [teams, setTeams] = useState<{id: string, name: string, category: string}[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

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

      // Get submissions with team and assignment data
      const { data: submissionsData, error } = await supabase
        .from('submissions')
        .select(`
          *,
          assignments!inner(number, title, points_base),
          teams!inner(name, category)
        `)
        .eq('game_session_id', configData.game_session_id)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error loading submissions:', error);
        return;
      }

      // Transform data to flat structure
      const transformedSubmissions = submissionsData?.map(sub => ({
        ...sub,
        assignment_number: (sub.assignments as any).number,
        assignment_title: (sub.assignments as any).title,
        assignment_points_base: (sub.assignments as any).points_base,
        team_name: (sub.teams as any).name,
        team_category: (sub.teams as any).category,
      })) || [];

      setSubmissions(transformedSubmissions);

      // Get unique teams for filter
      const uniqueTeams = Array.from(
        new Map(transformedSubmissions.map(s => [s.team_id, { 
          id: s.team_id, 
          name: s.team_name!, 
          category: s.team_category! 
        }])).values()
      );
      setTeams(uniqueTeams);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // NIEUWE VERBETERDE HANDLE REVIEW FUNCTIE MET SYNCHRONISATIE
  const handleReview = async (submissionId: string, status: 'approved' | 'rejected', points?: number, notes?: string) => {
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) return;

      // Bereken punten
      let finalPoints = 0;
      if (status === 'approved') {
        if (customPoints !== null) {
          finalPoints = customPoints;
        } else {
          finalPoints = submission.assignment_points_base || 1;
          if (config?.double_points_active) {
            finalPoints *= 2;
          }
        }
      }

      // Update submission
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          status,
          points_awarded: finalPoints,
          jury_notes: notes || '',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating submission:', updateError);
        alert('Fout bij opslaan van beoordeling');
        return;
      }

      // NIEUWE LOGICA: Synchroniseer met scores tabel
      if (status === 'approved') {
        // Voeg score toe aan scores tabel (dit is wat de jury pagina gebruikt)
        const { error: scoreError } = await supabase
          .from('scores')
          .upsert({
            team_id: submission.team_id,
            assignment_id: parseInt(submission.assignment_id), // Zorg dat dit een number is
            points: finalPoints,
            game_session_id: config?.game_session_id,
            created_via: 'review' // Markering dat dit via review kwam
          }, {
            onConflict: 'team_id,assignment_id,game_session_id'
          });

        if (scoreError) {
          console.error('Error creating score:', scoreError);
          // Probeer alsnog met string assignment_id als number niet werkt
          const { error: scoreError2 } = await supabase
            .from('scores')
            .upsert({
              team_id: submission.team_id,
              assignment_id: submission.assignment_id,
              points: finalPoints,
              game_session_id: config?.game_session_id,
              created_via: 'review'
            }, {
              onConflict: 'team_id,assignment_id,game_session_id'
            });
          
          if (scoreError2) {
            console.error('Error creating score (attempt 2):', scoreError2);
            alert('Waarschuwing: Punten opgeslagen in review maar niet gesynchroniseerd met jury pagina. Check de database.');
          }
        }
      } else {
        // Als afgekeurd, verwijder score uit scores tabel
        await supabase
          .from('scores')
          .delete()
          .eq('team_id', submission.team_id)
          .eq('assignment_id', submission.assignment_id)
          .eq('game_session_id', config?.game_session_id);
      }

      // Update local state
      setSubmissions(prev => prev.map(s => 
        s.id === submissionId 
          ? { ...s, status, points_awarded: finalPoints, jury_notes: notes || '', reviewed_at: new Date().toISOString() }
          : s
      ));

      // Reset en sluit modal
      setReviewModal(false);
      setSelectedSubmission(null);
      setJuryNotes('');
      setCustomPoints(null);

      alert(`✅ ${status === 'approved' ? 'Goedgekeurd' : 'Afgekeurd'} en gesynchroniseerd met jury pagina!`);

    } catch (error) {
      console.error('Error in handleReview:', error);
      alert('Er ging iets mis bij het beoordelen');
    }
  };

  // NIEUWE SYNCHRONISATIE FUNCTIE
  const synchronizeAllApprovedSubmissions = async () => {
    if (!confirm('Wil je alle goedgekeurde submissions synchroniseren met de jury pagina? Dit kan even duren.')) {
      return;
    }

    try {
      setSyncing(true);
      const approvedSubmissions = submissions.filter(s => s.status === 'approved');
      let syncedCount = 0;
      
      for (const submission of approvedSubmissions) {
        // Check of er al een score bestaat
        const { data: existingScore } = await supabase
          .from('scores')
          .select('id')
          .eq('team_id', submission.team_id)
          .eq('assignment_id', submission.assignment_id)
          .eq('game_session_id', config?.game_session_id)
          .single();

        if (!existingScore) {
          // Voeg ontbrekende score toe
          const { error } = await supabase
            .from('scores')
            .insert({
              team_id: submission.team_id,
              assignment_id: submission.assignment_id,
              points: submission.points_awarded,
              game_session_id: config?.game_session_id,
              created_via: 'sync'
            });
          
          if (!error) {
            syncedCount++;
          }
        }
      }
      
      alert(`✅ ${syncedCount} submissions gesynchroniseerd met jury pagina!`);
    } catch (error) {
      console.error('Sync error:', error);
      alert('❌ Fout bij synchroniseren');
    } finally {
      setSyncing(false);
    }
  };

  const openReviewModal = (submission: Submission) => {
    setSelectedSubmission(submission);
    setJuryNotes(submission.jury_notes || '');
    setCustomPoints(null);
    setReviewModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 border-green-300 text-green-800';
      case 'rejected': return 'bg-red-100 border-red-300 text-red-800';
      case 'needs_review': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'needs_review': return '🔍';
      default: return '⏳';
    }
  };

  const calculatePoints = (submission: Submission) => {
    if (customPoints !== null) return customPoints;
    let points = submission.assignment_points_base || 1;
    if (config?.double_points_active) points *= 2;
    return points;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getMediaUrl = (submission: Submission) => {
    return submission.photo_url || submission.video_url || submission.audio_url;
  };

  const isVideo = (submission: Submission) => {
    return submission.video_url || submission.file_type?.startsWith('video/');
  };

  const isAudio = (submission: Submission) => {
    return submission.audio_url || submission.file_type?.startsWith('audio/');
  };

  const filteredSubmissions = submissions.filter(submission => {
    const statusMatch = filter === 'all' || submission.status === filter;
    const teamMatch = teamFilter === 'all' || submission.team_id === teamFilter;
    const categoryMatch = categoryFilter === 'all' || submission.team_category === categoryFilter;
    return statusMatch && teamMatch && categoryMatch;
  });

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  // Bulk actions
  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedSubmissions.size === 0) return;
    
    if (!confirm(`Weet je zeker dat je ${selectedSubmissions.size} submissions wilt ${action === 'approve' ? 'goedkeuren' : 'afwijzen'}?`)) {
      return;
    }

    try {
      for (const submissionId of selectedSubmissions) {
        await handleReview(submissionId, action === 'approve' ? 'approved' : 'rejected');
      }
      setSelectedSubmissions(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Er ging iets mis bij de bulk actie');
    }
  };

  const toggleSubmissionSelection = (submissionId: string) => {
    const newSelection = new Set(selectedSubmissions);
    if (newSelection.has(submissionId)) {
      newSelection.delete(submissionId);
    } else {
      newSelection.add(submissionId);
    }
    setSelectedSubmissions(newSelection);
  };

  if (loading) {
    return <div className="loading">Submissions laden...</div>;
  }

  return (
    <div className="jury-review">
      {/* UPDATED HEADER MET SYNC BUTTON */}
      <div className="review-header">
        <h2>👩‍⚖️ Jury Review</h2>
        <div className="header-actions">
          <button 
            onClick={synchronizeAllApprovedSubmissions}
            className="sync-btn"
            disabled={syncing}
            title="Synchroniseer alle goedgekeurde submissions met jury pagina"
          >
            {syncing ? '🔄 Bezig...' : '🔄 Sync met Jury'}
          </button>
          <div className="review-stats">
            <span className="stat pending">⏳ {pendingCount} wachtend</span>
            <span className="stat approved">✅ {approvedCount} goedgekeurd</span>
            <span className="stat rejected">❌ {rejectedCount} afgewezen</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="review-filters">
        <div className="filter-row">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Alle statussen</option>
            <option value="pending">Wachtend ({pendingCount})</option>
            <option value="approved">Goedgekeurd ({approvedCount})</option>
            <option value="rejected">Afgewezen ({rejectedCount})</option>
            <option value="needs_review">Herziening</option>
          </select>

          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">Alle teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Alle categorieën</option>
            <option value="AVFV">AVFV</option>
            <option value="MR">MR</option>
            <option value="JEM">JEM</option>
          </select>

          <button 
            onClick={() => setBulkMode(!bulkMode)}
            className={`bulk-toggle ${bulkMode ? 'active' : ''}`}
          >
            {bulkMode ? '❌ Bulk uit' : '✅ Bulk aan'}
          </button>
        </div>

        {bulkMode && selectedSubmissions.size > 0 && (
          <div className="bulk-actions">
            <span>{selectedSubmissions.size} geselecteerd</span>
            <button onClick={() => handleBulkAction('approve')} className="bulk-approve">
              ✅ Goedkeuren
            </button>
            <button onClick={() => handleBulkAction('reject')} className="bulk-reject">
              ❌ Afwijzen
            </button>
            <button onClick={() => setSelectedSubmissions(new Set())} className="bulk-clear">
              🗑️ Wissen
            </button>
          </div>
        )}
      </div>

      {/* Submissions Grid */}
      <div className="submissions-grid">
        {filteredSubmissions.map(submission => (
          <div 
            key={submission.id} 
            className={`submission-card ${getStatusColor(submission.status)} ${bulkMode && selectedSubmissions.has(submission.id) ? 'selected' : ''}`}
          >
            {bulkMode && (
              <input
                type="checkbox"
                className="bulk-checkbox"
                checked={selectedSubmissions.has(submission.id)}
                onChange={() => toggleSubmissionSelection(submission.id)}
              />
            )}

            <div className="submission-header">
              <div className="submission-info">
                <span className="assignment-number">#{submission.assignment_number}</span>
                <span className="team-name">{submission.team_name}</span>
                <span className="team-category">({submission.team_category})</span>
              </div>
              <div className="submission-status">
                {getStatusEmoji(submission.status)}
              </div>
            </div>

            <div className="submission-content">
              <h4 className="assignment-title">{submission.assignment_title}</h4>
              
              {/* Media Preview */}
              <div className="media-preview">
                {getMediaUrl(submission) && (
                  <>
                    {isVideo(submission) ? (
                      <video 
                        src={getMediaUrl(submission)} 
                        controls 
                        className="preview-video"
                        preload="metadata"
                      />
                    ) : isAudio(submission) ? (
                      <div className="audio-player">
                        <audio 
                          ref={audioRef}
                          src={getMediaUrl(submission)} 
                          controls 
                          className="preview-audio"
                        />
                      </div>
                    ) : (
                      <img 
                        src={getMediaUrl(submission)} 
                        alt="Submission" 
                        className="preview-image"
                        loading="lazy"
                      />
                    )}
                  </>
                )}
              </div>

              {submission.description && (
                <p className="submission-description">{submission.description}</p>
              )}
            </div>

            <div className="submission-footer">
              <div className="submission-meta">
                <span className="points-info">
                  {submission.status === 'approved' 
                    ? `+${submission.points_awarded} punten` 
                    : `${submission.assignment_points_base}${config?.double_points_active ? 'x2' : ''} punten`
                  }
                </span>
                <span className="file-info">
                  {formatFileSize(submission.file_size)}
                </span>
                <span className="time-info">
                  {new Date(submission.submitted_at).toLocaleString('nl-NL', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {!bulkMode && (
                <div className="quick-actions">
                  {submission.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleReview(submission.id, 'approved')}
                        className="quick-approve"
                        title="Snel goedkeuren"
                      >
                        ✅
                      </button>
                      <button 
                        onClick={() => handleReview(submission.id, 'rejected')}
                        className="quick-reject"
                        title="Snel afwijzen"
                      >
                        ❌
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => openReviewModal(submission)}
                    className="detailed-review"
                    title="Gedetailleerde beoordeling"
                  >
                    🔍
                  </button>
                </div>
              )}
            </div>

            {submission.jury_notes && (
              <div className="jury-notes">
                <strong>Notities:</strong> {submission.jury_notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSubmissions.length === 0 && (
        <div className="no-submissions">
          <h3>Geen submissions gevonden</h3>
          <p>Probeer je filters aan te passen of wacht op nieuwe submissions van teams.</p>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && selectedSubmission && (
        <div className="modal-overlay" onClick={() => setReviewModal(false)}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gedetailleerde beoordeling</h3>
              <button onClick={() => setReviewModal(false)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="submission-details">
                <h4>#{selectedSubmission.assignment_number} - {selectedSubmission.assignment_title}</h4>
                <p><strong>Team:</strong> {selectedSubmission.team_name} ({selectedSubmission.team_category})</p>
                <p><strong>Ingezonden:</strong> {new Date(selectedSubmission.submitted_at).toLocaleString('nl-NL')}</p>
              </div>

              {/* Large Media View */}
              <div className="large-media">
                {getMediaUrl(selectedSubmission) && (
                  <>
                    {isVideo(selectedSubmission) ? (
                      <video 
                        src={getMediaUrl(selectedSubmission)} 
                        controls 
                        className="large-video"
                      />
                    ) : isAudio(selectedSubmission) ? (
                      <audio 
                        src={getMediaUrl(selectedSubmission)} 
                        controls 
                        className="large-audio"
                      />
                    ) : (
                      <img 
                        src={getMediaUrl(selectedSubmission)} 
                        alt="Submission" 
                        className="large-image"
                      />
                    )}
                  </>
                )}
              </div>

              {/* Points Configuration */}
              <div className="points-config">
                <h4>Punten toekenning</h4>
                <div className="points-options">
                  <label>
                    <input 
                      type="radio" 
                      name="points" 
                      checked={customPoints === null}
                      onChange={() => setCustomPoints(null)}
                    />
                    Standaard ({calculatePoints(selectedSubmission)} punten)
                    {config?.double_points_active && <span className="double-notice"> - Dubbele punten actief!</span>}
                  </label>
                  <label>
                    <input 
                      type="radio" 
                      name="points" 
                      checked={customPoints !== null}
                      onChange={() => setCustomPoints(selectedSubmission.assignment_points_base || 1)}
                    />
                    Custom punten:
                    <input 
                      type="number" 
                      min="0" 
                      max="10"
                      value={customPoints || ''} 
                      onChange={(e) => setCustomPoints(parseInt(e.target.value) || 0)}
                      disabled={customPoints === null}
                    />
                  </label>
                </div>
              </div>

              {/* Jury Notes */}
              <div className="jury-notes-input">
                <label>Jury notities (optioneel):</label>
                <textarea
                  value={juryNotes}
                  onChange={(e) => setJuryNotes(e.target.value)}
                  placeholder="Opmerkingen over deze submission..."
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="review-actions">
                <button 
                  onClick={() => handleReview(selectedSubmission.id, 'approved', calculatePoints(selectedSubmission), juryNotes)}
                  className="approve-btn"
                >
                  ✅ Goedkeuren ({customPoints !== null ? customPoints : calculatePoints(selectedSubmission)} punten)
                </button>
                <button 
                  onClick={() => handleReview(selectedSubmission.id, 'rejected', 0, juryNotes)}
                  className="reject-btn"
                >
                  ❌ Afwijzen
                </button>
                <button 
                  onClick={() => handleReview(selectedSubmission.id, 'needs_review', 0, juryNotes)}
                  className="review-btn"
                >
                  🔍 Markeer voor herziening
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Syncing Overlay */}
      {syncing && (
        <div className="syncing-overlay">
          <div className="syncing-content">
            <div className="syncing-spinner"></div>
            <p>Synchroniseren met jury pagina...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JuryReviewInterface;