import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Team {
  id: string;
  name: string;
  category: string;
  access_token: string;
  game_session_id: string;
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
  console.log('🎯 TeamInterface loaded with token:', token);
  
  // Controleer of token geldig is
  if (!token || token.length !== 8) {
    console.error('❌ Invalid token received:', token);
    return (
      <div className="team-error">
        <h2>❌ Ongeldige Team Link</h2>
        <p>De team link is ongeldig. Controleer de QR code en probeer opnieuw.</p>
        <button onClick={() => window.location.href = window.location.origin}>
          🏠 Terug naar start
        </button>
      </div>
    );
  }

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
  
  // Nieuwe states voor compressie
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadTeamData();
  }, [token]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading team data for token:', token);
      
      // Find team by token
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('access_token', token)
        .single();

      console.log('📊 Team query result:', { teamData, teamError });

      if (teamError || !teamData) {
        console.error('❌ Team not found:', teamError);
        setError('Team niet gevonden. Controleer de QR code en probeer opnieuw.');
        return;
      }

      console.log('✅ Team found:', teamData.name);
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
      console.error('💥 Error loading team data:', err);
      setError('Er ging iets mis bij het laden van de gegevens.');
    } finally {
      setLoading(false);
    }
  };

  // COMPRESSIE FUNCTIES
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Bereken nieuwe dimensies (max 1920x1080 voor HD kwaliteit)
        let { width, height } = img;
        const maxWidth = 1920;
        const maxHeight = 1080;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Teken afbeelding op canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Bepaal kwaliteit op basis van originele bestandsgrootte
        let quality = 0.8;
        if (file.size > 5 * 1024 * 1024) quality = 0.6; // >5MB
        if (file.size > 10 * 1024 * 1024) quality = 0.4; // >10MB
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const compressVideo = async (file: File): Promise<File> => {
    // Voor video's kunnen we alleen de kwaliteit verlagen via een canvas approach
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      
      video.onloadedmetadata = () => {
        // Verkleen video dimensies
        const maxWidth = 1280;
        const maxHeight = 720;
        let { videoWidth: width, videoHeight: height } = video;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Teken eerste frame (voor thumbnail)
        video.currentTime = 0;
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, width, height);
          
          // Converteer naar JPEG thumbnail
          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size * 0.8) {
              const thumbnailFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(thumbnailFile);
            } else {
              resolve(file); // Gebruik origineel als compressie niet helpt
            }
          }, 'image/jpeg', 0.7);
        };
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const compressFile = async (file: File): Promise<File> => {
  setCompressionProgress(10);
  setOriginalSize(file.size);
  
  let compressedFile = file;
  
  try {
    if (file.type.startsWith('image/')) {
      setCompressionProgress(30);
      compressedFile = await compressImage(file);
      setCompressionProgress(80);
    } else if (file.type.startsWith('video/')) {
      setCompressionProgress(30);
      
      // Agressievere video compressie via Canvas + WebRTC
      if (file.size > 10 * 1024 * 1024) { // >10MB wordt gecomprimeerd
        try {
          compressedFile = await compressVideoAdvanced(file);
          setCompressionProgress(70);
        } catch (videoError) {
          console.warn('Video compressie mislukt, probeer thumbnail:', videoError);
          // Fallback naar thumbnail als video compressie mislukt
          compressedFile = await compressVideo(file);
        }
      }
      setCompressionProgress(80);
    }
    // Audio blijft ongewijzigd
    
    setCompressionProgress(100);
    setCompressedSize(compressedFile.size);
    
    return compressedFile;
  } catch (error) {
    console.error('Compressie fout:', error);
    setCompressionProgress(100);
    return file;
  }
};

// VOEG deze nieuwe functie toe aan TeamInterface.tsx:

const compressVideoAdvanced = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video;
      
      // Bepaal nieuwe dimensies (agressievere verkleining voor grote bestanden)
      let targetWidth = videoWidth;
      let targetHeight = videoHeight;
      
      if (file.size > 50 * 1024 * 1024) { // >50MB: zeer agressief
        const ratio = Math.min(720 / videoWidth, 480 / videoHeight);
        targetWidth = Math.floor(videoWidth * ratio);
        targetHeight = Math.floor(videoHeight * ratio);
      } else if (file.size > 20 * 1024 * 1024) { // >20MB: matig agressief  
        const ratio = Math.min(1280 / videoWidth, 720 / videoHeight);
        targetWidth = Math.floor(videoWidth * ratio);
        targetHeight = Math.floor(videoHeight * ratio);
      }
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Voor zeer lange video's (>30 sec), maak een gecomprimeerde versie
      if (duration > 30) {
        // Maak een korte preview (eerste 30 seconden als frames)
        createVideoPreview(video, canvas, ctx, resolve, file.name);
      } else {
        // Voor korte video's, maak een thumbnail
        video.currentTime = duration / 2; // Midden van video
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Zeer lage kwaliteit voor grote bestanden
          const quality = file.size > 50 * 1024 * 1024 ? 0.3 : 0.6;
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Video compressie mislukt'));
            }
          }, 'image/jpeg', quality);
        };
      }
    };
    
    video.onerror = () => reject(new Error('Video laden mislukt'));
    video.src = URL.createObjectURL(file);
  });
};

// VOEG deze helper functie toe:

const createVideoPreview = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, resolve: (file: File) => void, originalName: string) => {
  const frames: string[] = [];
  const frameCount = 10; // 10 frames voor preview
  const duration = Math.min(video.duration, 30); // Max 30 seconden
  let currentFrame = 0;
  
  const captureFrame = () => {
    if (currentFrame >= frameCount) {
      // Alle frames verzameld, maak een collage
      createFrameCollage(frames, canvas, ctx, resolve, originalName);
      return;
    }
    
    video.currentTime = (currentFrame / frameCount) * duration;
    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.7));
      currentFrame++;
      captureFrame();
    };
  };
  
  captureFrame();
};

const createFrameCollage = (frames: string[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, resolve: (file: File) => void, originalName: string) => {
  // Maak een collage van alle frames
  const cols = 5;
  const rows = 2;
  const frameWidth = canvas.width / cols;
  const frameHeight = canvas.height / rows;
  
  canvas.width = frameWidth * cols;
  canvas.height = frameHeight * rows;
  
  let loadedFrames = 0;
  
  frames.forEach((frameData, index) => {
    const img = new Image();
    img.onload = () => {
      const x = (index % cols) * frameWidth;
      const y = Math.floor(index / cols) * frameHeight;
      ctx.drawImage(img, x, y, frameWidth, frameHeight);
      
      loadedFrames++;
      if (loadedFrames === frames.length) {
        // Alle frames getekend, maak het finale bestand
        canvas.toBlob((blob) => {
          if (blob) {
            const previewFile = new File([blob], originalName.replace(/\.[^/.]+$/, '_preview.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(previewFile);
          }
        }, 'image/jpeg', 0.8);
      }
    };
    img.src = frameData;
  });
};

  // UPLOAD FUNCTIE MET RETRY EN PROGRESS
  const uploadWithRetry = async (file: File, fileName: string, maxRetries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setUploadProgress(20 * attempt);
        
        const { data, error } = await supabase.storage
          .from('submissions')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });
        
        setUploadProgress(100);
        
        if (!error) {
          return { data, error: null };
        }
        
        if (attempt === maxRetries) {
          throw new Error(error.message);
        }
        
        // Wacht voor volgende poging
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        console.warn(`Upload poging ${attempt} mislukt:`, error.message);
      }
    }
  };

  // HOOFDUPLOAD FUNCTIE
  const handleFileUpload = async (file: File) => {
    if (!selectedAssignment || !team) {
      alert('❌ Ontbrekende gegevens. Probeer opnieuw.');
      return;
    }

    try {
      setUploading(true);
      setCompressionProgress(0);
      setUploadProgress(0);
      setOriginalSize(0);
      setCompressedSize(0);
      
      console.log('🚀 Upload gestart voor:', file.name);

      // Stap 1: Valideer bestand
      const maxSize = 150 * 1024 * 1024; // 50MB max
      if (file.size > maxSize) {
  const fileSizeMB = Math.round(file.size / (1024 * 1024));
  const maxSizeMB = Math.round(maxSize / (1024 * 1024));
  throw new Error(`Bestand te groot (${fileSizeMB}MB). Maximum ${maxSizeMB}MB toegestaan. Probeer een korter filmpje of lagere kwaliteit.`);
}

      const isValidType = (
        (selectedAssignment.requires_photo && file.type.startsWith('image/')) ||
        (selectedAssignment.requires_video && file.type.startsWith('video/')) ||
        (selectedAssignment.requires_audio && file.type.startsWith('audio/'))
      );

      if (!isValidType) {
        const required = [];
        if (selectedAssignment.requires_photo) required.push('foto');
        if (selectedAssignment.requires_video) required.push('video');
        if (selectedAssignment.requires_audio) required.push('audio');
        throw new Error(`Dit opdracht vereist: ${required.join(' of ')}. Upload het juiste bestandstype.`);
      }

      // Stap 2: Comprimeer bestand
      console.log('🗜️ Bestand comprimeren...');
      const compressedFile = await compressFile(file);
      
      // Toon compressie resultaat
      if (compressedFile.size < file.size) {
        const saved = Math.round((1 - compressedFile.size / file.size) * 100);
        console.log(`✅ Compressie succesvol: ${saved}% kleiner`);
      }

      // Stap 3: Upload naar Supabase
      console.log('📤 Uploaden naar server...');
      const fileExt = file.type.startsWith('image/') ? 'jpg' : 
                     file.name.split('.').pop()?.toLowerCase() || 'unknown';
      const fileName = `${team.id}/${selectedAssignment.number}_${Date.now()}.${fileExt}`;
      
      const uploadResult = await uploadWithRetry(compressedFile, fileName);
      
      if (uploadResult.error) {
        throw new Error(`Upload mislukt: ${uploadResult.error.message}`);
      }

      // Stap 4: Verkrijg publieke URL
      const { data: { publicUrl } } = supabase.storage
        .from('submissions')
        .getPublicUrl(fileName);

      console.log('🔗 Publieke URL verkregen');

      // Stap 5: Maak database record
      console.log('💾 Database record maken...');
      
      const submissionData: any = {
        assignment_id: selectedAssignment.id,
        team_id: team.id,
        game_session_id: team.game_session_id,
        status: 'pending' as const,
        file_path: fileName,
        file_type: compressedFile.type,
        file_size: compressedFile.size
      };

      // Voeg URL toe op basis van bestandstype
      if (compressedFile.type.startsWith('image/')) {
        submissionData.photo_url = publicUrl;
      } else if (compressedFile.type.startsWith('video/')) {
        submissionData.video_url = publicUrl;
      } else if (compressedFile.type.startsWith('audio/')) {
        submissionData.audio_url = publicUrl;
      }

      // Check of submission al bestaat
      const { data: existingSubmission } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', selectedAssignment.id)
        .eq('team_id', team.id)
        .eq('game_session_id', team.game_session_id)
        .single();

      let submission;
      
      if (existingSubmission) {
        // Update bestaande submission
        const { data: updatedSubmission, error: updateError } = await supabase
          .from('submissions')
          .update(submissionData)
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Database update fout: ${updateError.message}`);
        }
        submission = updatedSubmission;
      } else {
        // Maak nieuwe submission
        const { data: newSubmission, error: insertError } = await supabase
          .from('submissions')
          .insert([submissionData])
          .select()
          .single();

        if (insertError) {
          throw new Error(`Database insert fout: ${insertError.message}`);
        }
        submission = newSubmission;
      }

      console.log('✅ Upload volledig succesvol!');

      // Update local state
      setSubmissions(prev => {
        const filtered = prev.filter(s => s.assignment_id !== selectedAssignment.id);
        return [...filtered, submission];
      });
      
      // Reset en sluit modal
      resetUploadState();
      setUploadModal(false);
      setSelectedAssignment(null);
      
      // Toon succes bericht met compressie info
      const savedSpace = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;
      const message = savedSpace > 0 
        ? `✅ Upload succesvol!\n🗜️ ${savedSpace}% kleiner gemaakt\n⏳ Wacht op beoordeling van de jury.`
        : '✅ Upload succesvol!\n⏳ Wacht op beoordeling van de jury.';
      
      alert(message);

    } catch (error: any) {
      console.error('💥 Upload error:', error);
      
      let errorMessage = '❌ Upload mislukt.';
      
      if (error.message.includes('bucket')) {
        errorMessage = '❌ Opslagprobleem. Vernieuw de pagina en probeer opnieuw.';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = '❌ Verbindingsprobleem. Controleer je internet en probeer opnieuw.';
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }
      
      alert(errorMessage);
      
    } finally {
      setUploading(false);
      resetUploadState();
    }
  };

  const resetUploadState = () => {
    setCompressionProgress(0);
    setUploadProgress(0);
    setOriginalSize(0);
    setCompressedSize(0);
  };

  // HELPER FUNCTIES
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // FILTERS
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
              
              {/* Progress Indicators */}
              {uploading && (
                <div style={{ marginBottom: '1rem' }}>
                  {/* Compression Progress */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                      <span>🗜️ Comprimeren</span>
                      <span>{compressionProgress}%</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', height: '0.5rem' }}>
                      <div style={{ 
                        width: `${compressionProgress}%`, 
                        backgroundColor: '#10b981', 
                        height: '100%', 
                        borderRadius: '0.375rem',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>

                  {/* Upload Progress */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                      <span>📤 Uploaden</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', height: '0.5rem' }}>
                      <div style={{ 
                        width: `${uploadProgress}%`, 
                        backgroundColor: '#3b82f6', 
                        height: '100%', 
                        borderRadius: '0.375rem',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>

                  {/* File Size Info */}
                  {originalSize > 0 && compressedSize > 0 && (
                    <div style={{ 
                      marginTop: '0.75rem', 
                      padding: '0.75rem', 
                      backgroundColor: '#f0f9ff', 
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      <div>📁 Origineel: {formatFileSize(originalSize)}</div>
                      <div>🗜️ Gecomprimeerd: {formatFileSize(compressedSize)}</div>
                      {compressedSize < originalSize && (
                        <div style={{ color: '#059669', fontWeight: '600' }}>
                          💾 {Math.round((1 - compressedSize / originalSize) * 100)}% kleiner!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
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
                  {uploading ? '⏳ Bezig met uploaden...' : '📁 Kies bestand'}
                </button>
                
                <div className="requirements">
                  <p>Vereist voor deze opdracht:</p>
                  {selectedAssignment.requires_photo && <span>📸 Foto</span>}
                  {selectedAssignment.requires_video && <span>🎥 Video</span>}
                  {selectedAssignment.requires_audio && <span>🎵 Audio</span>}
                </div>

                {/* Tips */}
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  backgroundColor: '#fef3cd', 
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#92400e'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>💡 Tips:</div>
                  <div>• Foto's worden automatisch verkleind voor snellere upload</div>
                  <div>• Video's korter dan 30 sec werken het beste</div>
                  <div>• Maximum bestandsgrootte: 50MB</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Canvas voor Image Compressie */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default TeamInterface;