import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
  access_token: string;
}

interface Assignment {
  id: string;
  number: number;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  points_base: number;
  requires_photo: boolean;
  requires_video: boolean;
  requires_audio: boolean;
}

interface Submission {
  id: string;
  assignment_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  points_awarded: number;
  submitted_at: string;
  photo_url?: string;
  video_url?: string;
}

const TeamInterface = ({ token }: { token: string }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTeamData();
  }, [token]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      
      // Find team by token
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('access_token', token)
        .single();

      if (teamError || !teamData) {
        setError('Team niet gevonden. Controleer de QR code en probeer opnieuw.');
        return;
      }

      setTeam(teamData);

      // Load assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .eq('is_active', true)
        .order('number');

      if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError);
      } else {
        setAssignments(assignmentsData || []);
      }

      // Load submissions for this team
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('team_id', teamData.id)
        .eq('game_session_id', teamData.game_session_id);

      if (submissionsError) {
        console.error('Error loading submissions:', submissionsError);
      } else {
        setSubmissions(submissionsData || []);
      }

    } catch (err) {
      console.error('Error loading team data:', err);
      setError('Er ging iets mis bij het laden van de gegevens.');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionForAssignment = (assignmentId: string) => {
    return submissions.find(s => s.assignment_id === assignmentId);
  };

  const getAssignmentStatus = (assignment: Assignment) => {
    const submission = getSubmissionForAssignment(assignment.id);
    if (!submission) return 'not_started';
    return submission.status;
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'approved': return '✅';
      case 'pending': return '⏳';
      case 'rejected': return '❌';
      case 'needs_review': return '🔍';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 border-green-300 text-green-800';
      case 'pending': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'rejected': return 'bg-red-100 border-red-300 text-red-800';
      case 'needs_review': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-orange-500';
      case 'extreme': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAssignmentClick = (assignment: Assignment) => {
    const submission = getSubmissionForAssignment(assignment.id);
    if (submission && submission.status === 'approved') {
      // Already completed, just show details
      setSelectedAssignment(assignment);
      return;
    }
    
    // Open upload modal
    setSelectedAssignment(assignment);
    setUploadModal(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedAssignment || !team) return;

    try {
      setUploading(true);

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${team.id}/${selectedAssignment.number}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('submissions')
        .getPublicUrl(fileName);

      // Create submission record
      const submissionData = {
        assignment_id: selectedAssignment.id,
        team_id: team.id,
        game_session_id: team.game_session_id,
        status: 'pending' as const,
        description: '', // Could add description field later
      };

      // Add URL based on file type
      if (file.type.startsWith('image/')) {
        submissionData['photo_url'] = publicUrl;
      } else if (file.type.startsWith('video/')) {
        submissionData['video_url'] = publicUrl;
      }

      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert([submissionData])
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Update local state
      setSubmissions(prev => [...prev.filter(s => s.assignment_id !== selectedAssignment.id), submission]);
      setUploadModal(false);
      setSelectedAssignment(null);

    } catch (error) {
      console.error('Upload error:', error);
      alert('Er ging iets mis bij het uploaden. Probeer het opnieuw.');
    } finally {
      setUploading(false);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.number.toString().includes(searchTerm);
    
    const matchesCategory = categoryFilter === 'all' || assignment.category === categoryFilter;
    
    const status = getAssignmentStatus(assignment);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPoints = submissions
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + s.points_awarded, 0);

  const completedCount = submissions.filter(s => s.status === 'approved').length;

  if (loading) {
    return (
      <div className="team-loading">
        <div className="loading-spinner"></div>
        <p>Team gegevens laden...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-error">
        <h2>❌ Fout</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          🔄 Probeer opnieuw
        </button>
      </div>
    );
  }

  return (
    <div className="team-interface">
      {/* Header */}
      <div className="team-header">
        <div className="team-info">
          <h1>🎲 {team?.name}</h1>
          <div className="team-meta">
            <span className="team-category">{team?.category}</span>
            <span className="team-score">{totalPoints} punten</span>
            <span className="team-progress">{completedCount}/88 opdrachten</span>
          </div>
        </div>
        <div className="team-progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(completedCount / 88) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Filters */}
      <div className="team-filters">
        <input
          type="text"
          placeholder="🔍 Zoek opdrachten..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <div className="filter-row">
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Alle categorieën</option>
            <option value="general">General</option>
            <option value="social">Social</option>
            <option value="creative">Creative</option>
            <option value="physical">Physical</option>
            <option value="challenge">Challenge</option>
          </select>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Alle statussen</option>
            <option value="not_started">Nog te doen</option>
            <option value="pending">Wacht op beoordeling</option>
            <option value="approved">Goedgekeurd</option>
            <option value="rejected">Afgewezen</option>
          </select>
        </div>
      </div>

      {/* Assignments Grid */}
      <div className="assignments-grid">
        {filteredAssignments.map(assignment => {
          const status = getAssignmentStatus(assignment);
          const submission = getSubmissionForAssignment(assignment.id);
          
          return (
            <div 
              key={assignment.id}
              className={`assignment-card ${status} ${getStatusColor(status)}`}
              onClick={() => handleAssignmentClick(assignment)}
            >
              <div className="assignment-header">
                <div className="assignment-number">#{assignment.number}</div>
                <div className="assignment-status">
                  {getStatusEmoji(status)}
                </div>
              </div>
              
              <div className="assignment-content">
                <h3 className="assignment-title">{assignment.title}</h3>
                <p className="assignment-description">{assignment.description}</p>
              </div>
              
              <div className="assignment-footer">
                <div className="assignment-meta">
                  <span className={`difficulty-indicator ${getDifficultyColor(assignment.difficulty)}`}>
                    {assignment.difficulty}
                  </span>
                  <span className="points">{assignment.points_base} pt</span>
                </div>
                
                {submission && submission.status === 'approved' && (
                  <div className="points-awarded">
                    +{submission.points_awarded} punten
                  </div>
                )}
              </div>
              
              <div className="assignment-requirements">
                {assignment.requires_photo && <span className="req">📸</span>}
                {assignment.requires_video && <span className="req">🎥</span>}
                {assignment.requires_audio && <span className="req">🎵</span>}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAssignments.length === 0 && (
        <div className="no-assignments">
          <p>Geen opdrachten gevonden met de huidige filters.</p>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && selectedAssignment && (
        <div className="modal-overlay" onClick={() => setUploadModal(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📤 Upload bewijs</h3>
              <button onClick={() => setUploadModal(false)}>✕</button>
            </div>
            
            <div className="modal-content">
              <div className="assignment-info">
                <h4>#{selectedAssignment.number} - {selectedAssignment.title}</h4>
                <p>{selectedAssignment.description}</p>
              </div>
              
              <div className="upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={`${selectedAssignment.requires_photo ? 'image/*' : ''}${selectedAssignment.requires_video ? ',video/*' : ''}${selectedAssignment.requires_audio ? ',audio/*' : ''}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  style={{ display: 'none' }}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="upload-btn"
                >
                  {uploading ? '⏳ Uploaden...' : '📁 Kies bestand'}
                </button>
                
                <div className="requirements">
                  <p>Vereist:</p>
                  {selectedAssignment.requires_photo && <span>📸 Foto</span>}
                  {selectedAssignment.requires_video && <span>🎥 Video</span>}
                  {selectedAssignment.requires_audio && <span>🎵 Audio</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamInterface;