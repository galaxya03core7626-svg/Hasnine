/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  FileText,
  Presentation,
  BookOpen,
  Cloud,
  LogOut,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Play,
  Share2,
} from 'lucide-react';
import {
  auth,
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setAccessToken,
  saveWorkspaceNoteToFirestore,
  getWorkspaceNotesFromFirestore,
  deleteWorkspaceNoteFromFirestore,
  savePresetToFirestore,
  getPresetsFromFirestore,
  StoredPreset,
  StoredWorkspaceNote,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  listGoogleDocs,
  listGoogleSlides,
  fetchGoogleDoc,
  fetchGoogleSlidesPresentation,
  createGoogleDoc,
  GoogleDriveFile,
  ExtractedDocContent,
  ExtractedSlideContent,
} from '../services/workspaceService';
import { VisualizerConfig, ThemeType, VisualizerMode } from '../types/visualizer';

interface WorkspaceTabProps {
  config: VisualizerConfig;
  onUpdateConfig: (partial: Partial<VisualizerConfig>) => void;
  onApplyPreset?: (theme: ThemeType, mode: VisualizerMode, intensity: number) => void;
}

type WorkspaceSubSection = 'slides' | 'docs' | 'keep' | 'presets';

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({
  config,
  onUpdateConfig,
  onApplyPreset,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSubSection>('slides');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Docs state
  const [docsList, setDocsList] = useState<GoogleDriveFile[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ExtractedDocContent | null>(null);
  const [isLoadingDocContent, setIsLoadingDocContent] = useState(false);

  // Google Slides state
  const [slidesList, setSlidesList] = useState<GoogleDriveFile[]>([]);
  const [isLoadingSlides, setIsLoadingSlides] = useState(false);
  const [selectedPresentation, setSelectedPresentation] = useState<ExtractedSlideContent | null>(null);
  const [isLoadingPresentation, setIsLoadingPresentation] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Keep Notes state (Firestore + local)
  const [notes, setNotes] = useState<StoredWorkspaceNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('#lyrics');

  // Firestore Presets state
  const [presets, setPresets] = useState<StoredPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Confirmation Modal State (MANDATORY for mutating/destructive operations)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  // Track Auth state & in-memory token
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = initAuth(
      (user, cachedToken) => {
        setCurrentUser(user);
        if (cachedToken) {
          setToken(cachedToken);
        }
        if (user) {
          loadUserCloudData(user.uid);
        }
      },
      () => {
        setCurrentUser(null);
        setToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  const loadUserCloudData = async (uid: string) => {
    setIsLoadingNotes(true);
    setIsLoadingPresets(true);
    try {
      const [fetchedNotes, fetchedPresets] = await Promise.all([
        getWorkspaceNotesFromFirestore(uid),
        getPresetsFromFirestore(uid),
      ]);
      setNotes(fetchedNotes);
      setPresets(fetchedPresets);
    } catch (e) {
      console.warn('Failed loading initial cloud data:', e);
    } finally {
      setIsLoadingNotes(false);
      setIsLoadingPresets(false);
    }
  };

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setToken(res.accessToken);
        setAccessToken(res.accessToken);
        showNotification(`Signed in as ${res.user.displayName || res.user.email}`);
        loadUserCloudData(res.user.uid);
        // Automatically fetch files
        if (res.accessToken) {
          fetchDocs(res.accessToken);
          fetchSlides(res.accessToken);
        }
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMessage(err.message || 'Failed to sign in with Google');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setToken(null);
    setSelectedDoc(null);
    setSelectedPresentation(null);
    setDocsList([]);
    setSlidesList([]);
    showNotification('Signed out from Google Workspace');
  };

  // Google Docs actions
  const fetchDocs = async (tokenToUse?: string) => {
    const actToken = tokenToUse || token || (await getAccessToken());
    if (!actToken) {
      setErrorMessage('Please sign in with Google to load Google Docs');
      return;
    }
    setIsLoadingDocs(true);
    setErrorMessage(null);
    try {
      const files = await listGoogleDocs(actToken);
      setDocsList(files);
      if (files.length === 0) {
        showNotification('No Google Docs found in your Google Drive.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch Google Docs');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleSelectDoc = async (docFile: GoogleDriveFile) => {
    const actToken = token || (await getAccessToken());
    if (!actToken) return;
    setIsLoadingDocContent(true);
    try {
      const content = await fetchGoogleDoc(actToken, docFile.id);
      setSelectedDoc(content);
      showNotification(`Loaded "${content.title}"`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load document content');
    } finally {
      setIsLoadingDocContent(false);
    }
  };

  const handleApplyDocToVisualizer = (docContent: ExtractedDocContent) => {
    const title = docContent.title || 'Doc Lyrics';
    const firstParagraph = docContent.paragraphs[0] || 'Dynamic Lyrics Sync';
    onUpdateConfig({
      textOverlay: {
        ...config.textOverlay,
        enabled: true,
        title: title.length > 40 ? title.substring(0, 40) + '...' : title,
        subtitle: firstParagraph.length > 60 ? firstParagraph.substring(0, 60) + '...' : firstParagraph,
      },
    });
    showNotification(`Applied "${docContent.title}" to Dynamic Text Overlay!`);
  };

  const handleRequestExportToGoogleDoc = (title: string, content: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Export to Google Docs',
      description: `Create a new Google Document named "${title}" in your Google Drive with the visualizer setlist / note text?`,
      confirmLabel: 'Create Document',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const actToken = token || (await getAccessToken());
        if (!actToken) {
          setErrorMessage('Please sign in to export to Google Docs');
          return;
        }
        try {
          const newDoc = await createGoogleDoc(actToken, title, content);
          showNotification(`Created Google Doc "${newDoc.name}" successfully!`);
          fetchDocs(actToken);
        } catch (err: any) {
          setErrorMessage(err.message || 'Failed to export to Google Docs');
        }
      },
    });
  };

  // Google Slides actions
  const fetchSlides = async (tokenToUse?: string) => {
    const actToken = tokenToUse || token || (await getAccessToken());
    if (!actToken) {
      setErrorMessage('Please sign in with Google to load Google Slides');
      return;
    }
    setIsLoadingSlides(true);
    setErrorMessage(null);
    try {
      const files = await listGoogleSlides(actToken);
      setSlidesList(files);
      if (files.length === 0) {
        showNotification('No Google Slides presentations found in your Google Drive.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch Google Slides');
    } finally {
      setIsLoadingSlides(false);
    }
  };

  const handleSelectPresentation = async (slideFile: GoogleDriveFile) => {
    const actToken = token || (await getAccessToken());
    if (!actToken) return;
    setIsLoadingPresentation(true);
    try {
      const content = await fetchGoogleSlidesPresentation(actToken, slideFile.id);
      setSelectedPresentation(content);
      setCurrentSlideIndex(0);
      showNotification(`Loaded "${content.title}" with ${content.slides.length} slides`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load presentation content');
    } finally {
      setIsLoadingPresentation(false);
    }
  };

  const handleApplySlideToVisualizer = (slideIdx: number) => {
    if (!selectedPresentation || !selectedPresentation.slides[slideIdx]) return;
    const slide = selectedPresentation.slides[slideIdx];
    const subtitle = slide.bodyText.length > 0 ? slide.bodyText[0] : `Slide ${slide.pageNumber} of ${selectedPresentation.slides.length}`;
    onUpdateConfig({
      textOverlay: {
        ...config.textOverlay,
        enabled: true,
        title: slide.title,
        subtitle: subtitle.length > 60 ? subtitle.substring(0, 60) + '...' : subtitle,
      },
    });
    setCurrentSlideIndex(slideIdx);
    showNotification(`Visualizer text synced to Slide ${slideIdx + 1}: "${slide.title}"`);
  };

  // Keep Notes actions (Firestore)
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    if (!currentUser) {
      setErrorMessage('Please sign in to save notes to your cloud account');
      return;
    }

    const noteId = `note_${Date.now()}`;
    const newNote: Omit<StoredWorkspaceNote, 'userId' | 'createdAt' | 'updatedAt'> = {
      id: noteId,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      source: 'keep-note',
      tags: [newNoteTag, '#keep'],
    };

    try {
      await saveWorkspaceNoteToFirestore(currentUser.uid, newNote);
      setNotes((prev) => [
        {
          ...newNote,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewNoteTitle('');
      setNewNoteContent('');
      showNotification('Note saved to Firestore cloud storage!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save note');
    }
  };

  const handleDeleteNoteConfirm = (noteId: string, noteTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Workspace Note',
      description: `Are you sure you want to delete note "${noteTitle}"? This action cannot be undone.`,
      confirmLabel: 'Delete Note',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        if (!currentUser) return;
        try {
          await deleteWorkspaceNoteFromFirestore(currentUser.uid, noteId);
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
          showNotification(`Deleted note "${noteTitle}"`);
        } catch (err: any) {
          setErrorMessage(err.message || 'Failed to delete note');
        }
      },
    });
  };

  // Cloud Presets (Firestore)
  const handleSaveCurrentPreset = async () => {
    if (!newPresetName.trim()) return;
    if (!currentUser) {
      setErrorMessage('Please sign in with Google to sync presets to Cloud');
      return;
    }

    const presetId = `preset_${Date.now()}`;
    const presetData = {
      id: presetId,
      name: newPresetName.trim(),
      theme: String(config.theme),
      visualizerMode: config.visualizerMode,
      effectIntensity: config.effectIntensity,
      config: JSON.stringify(config),
    };

    try {
      await savePresetToFirestore(currentUser.uid, presetData);
      setPresets((prev) => [
        {
          ...presetData,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewPresetName('');
      showNotification(`Saved visualizer preset "${presetData.name}" to Cloud!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save preset');
    }
  };

  const handleApplyPresetItem = (p: StoredPreset) => {
    try {
      const parsedConfig = JSON.parse(p.config);
      onUpdateConfig(parsedConfig);
      if (onApplyPreset) {
        onApplyPreset(p.theme as ThemeType, p.visualizerMode as VisualizerMode, p.effectIntensity);
      }
      showNotification(`Applied Cloud Preset "${p.name}"!`);
    } catch {
      showNotification(`Applied theme: ${p.theme}, mode: ${p.visualizerMode}`);
    }
  };

  return (
    <div className="space-y-6 text-sm text-gray-200">
      {/* Notifications and Alerts */}
      {statusMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs shadow-lg animate-fadeIn">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-rose-300 text-xs shadow-lg">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Account Authentication Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-800/80 border border-gray-700/60 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white tracking-wide flex items-center gap-2">
                Google Workspace & Cloud Sync
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                  Docs • Slides • Keep
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {currentUser
                  ? `Signed in as ${currentUser.displayName || currentUser.email}`
                  : 'Connect your Google account to sync Docs, Slides lyrics, Keep notes, and Firestore presets.'}
              </p>
            </div>
          </div>

          <div>
            {!currentUser ? (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-800 font-medium text-xs rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isAuthenticating ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg border border-gray-700 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveSection('slides');
            if (currentUser && slidesList.length === 0) fetchSlides();
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'slides'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <Presentation className="w-4 h-4 text-amber-400" />
          <span>Google Slides</span>
          {slidesList.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-amber-500/30 text-amber-200 rounded-full font-mono">
              {slidesList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection('docs');
            if (currentUser && docsList.length === 0) fetchDocs();
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'docs'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>Google Docs</span>
          {docsList.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-blue-500/30 text-blue-200 rounded-full font-mono">
              {docsList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('keep')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'keep'
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4 text-yellow-400" />
          <span>Google Keep & Notes</span>
          {notes.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-yellow-500/30 text-yellow-200 rounded-full font-mono">
              {notes.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('presets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'presets'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <Cloud className="w-4 h-4 text-indigo-400" />
          <span>Cloud Presets</span>
          {presets.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-indigo-500/30 text-indigo-200 rounded-full font-mono">
              {presets.length}
            </span>
          )}
        </button>
      </div>

      {/* SECTION 1: GOOGLE SLIDES */}
      {activeSection === 'slides' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">Google Slides Presentation Synchronizer</h4>
              <p className="text-xs text-gray-400">
                Import slide decks from Google Drive to project slide titles and key bullet points onto the visualizer screen.
              </p>
            </div>
            {currentUser && (
              <button
                type="button"
                onClick={() => fetchSlides()}
                disabled={isLoadingSlides}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-amber-300 rounded-lg border border-amber-500/30 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSlides ? 'animate-spin' : ''}`} />
                <span>{isLoadingSlides ? 'Fetching...' : 'Refresh Slides'}</span>
              </button>
            )}
          </div>

          {!currentUser ? (
            <div className="p-6 text-center rounded-xl bg-gray-900/60 border border-dashed border-gray-700/80">
              <Presentation className="w-10 h-10 text-amber-400/50 mx-auto mb-2" />
              <p className="text-gray-300 text-sm font-medium">Sign in to view your Google Slides presentations</p>
              <p className="text-xs text-gray-500 mt-1">
                Your presentations will be loaded in real-time to synchronize slides with the music visualizer.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Presentation Files List */}
              <div className="p-3 bg-gray-900/80 border border-gray-800 rounded-xl max-h-72 overflow-y-auto space-y-2">
                <div className="text-[11px] font-semibold uppercase text-gray-400 px-1 tracking-wider">
                  Select a Presentation:
                </div>
                {slidesList.length === 0 ? (
                  <div className="text-xs text-gray-500 py-6 text-center">
                    {isLoadingSlides ? 'Loading your Google Slides...' : 'No presentations found. Create one in Google Slides or refresh.'}
                  </div>
                ) : (
                  slidesList.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectPresentation(file)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        selectedPresentation?.id === file.id
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                          : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-medium text-xs truncate">{file.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </div>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:text-amber-400 text-gray-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Selected Presentation Detail & Slide Selector */}
              <div className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3">
                <div className="text-[11px] font-semibold uppercase text-gray-400 tracking-wider">
                  Presentation Slides:
                </div>

                {isLoadingPresentation ? (
                  <div className="py-8 text-center text-xs text-amber-400 animate-pulse">
                    Parsing presentation slides and visual elements...
                  </div>
                ) : selectedPresentation ? (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-white truncate">
                      {selectedPresentation.title}
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {selectedPresentation.slides.map((s, idx) => (
                        <button
                          key={s.objectId}
                          type="button"
                          onClick={() => handleApplySlideToVisualizer(idx)}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            currentSlideIndex === idx
                              ? 'bg-amber-500/30 border-amber-400 text-white font-medium'
                              : 'bg-gray-800/60 border-gray-700/60 hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <div className="text-[10px] text-amber-400 font-mono">Slide {s.pageNumber}</div>
                          <div className="text-xs truncate font-medium mt-0.5">{s.title}</div>
                          {s.bodyText.length > 0 && (
                            <div className="text-[10px] text-gray-400 truncate mt-0.5">{s.bodyText[0]}</div>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                      <button
                        type="button"
                        onClick={() => handleApplySlideToVisualizer(currentSlideIndex)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-xs transition-colors shadow-md"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Project Slide to Visualizer</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-gray-500">
                    Select a presentation from the left to view and project its slides.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: GOOGLE DOCS */}
      {activeSection === 'docs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">Google Docs Lyrics & Script Extractor</h4>
              <p className="text-xs text-gray-400">
                Load lyrics, setlists, and speech scripts directly from Google Docs into dynamic audio-reactive text overlays.
              </p>
            </div>
            {currentUser && (
              <button
                type="button"
                onClick={() => fetchDocs()}
                disabled={isLoadingDocs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-blue-300 rounded-lg border border-blue-500/30 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                <span>{isLoadingDocs ? 'Fetching...' : 'Refresh Docs'}</span>
              </button>
            )}
          </div>

          {!currentUser ? (
            <div className="p-6 text-center rounded-xl bg-gray-900/60 border border-dashed border-gray-700/80">
              <FileText className="w-10 h-10 text-blue-400/50 mx-auto mb-2" />
              <p className="text-gray-300 text-sm font-medium">Sign in to view your Google Docs</p>
              <p className="text-xs text-gray-500 mt-1">
                Import any Google Doc to auto-populate track titles, lyrics, and responsive text overlays.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Docs Files List */}
              <div className="p-3 bg-gray-900/80 border border-gray-800 rounded-xl max-h-72 overflow-y-auto space-y-2">
                <div className="text-[11px] font-semibold uppercase text-gray-400 px-1 tracking-wider">
                  Select a Google Doc:
                </div>
                {docsList.length === 0 ? (
                  <div className="text-xs text-gray-500 py-6 text-center">
                    {isLoadingDocs ? 'Loading Google Docs...' : 'No documents found. Create one in Google Docs or refresh.'}
                  </div>
                ) : (
                  docsList.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectDoc(file)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        selectedDoc?.id === file.id
                          ? 'bg-blue-500/20 border-blue-500/60 text-blue-200'
                          : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-medium text-xs truncate">{file.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </div>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:text-blue-400 text-gray-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Selected Doc Preview & Extraction */}
              <div className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3">
                <div className="text-[11px] font-semibold uppercase text-gray-400 tracking-wider">
                  Document Content & Lyrics:
                </div>

                {isLoadingDocContent ? (
                  <div className="py-8 text-center text-xs text-blue-400 animate-pulse">
                    Extracting document paragraphs and formatted text...
                  </div>
                ) : selectedDoc ? (
                  <div className="space-y-3">
                    <div className="font-medium text-xs text-white truncate">
                      {selectedDoc.title}
                    </div>

                    <div className="max-h-40 overflow-y-auto p-2 bg-gray-950/70 rounded-lg text-xs font-mono text-gray-300 whitespace-pre-wrap border border-gray-800">
                      {selectedDoc.fullText || '(Empty document)'}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-800">
                      <button
                        type="button"
                        onClick={() => handleApplyDocToVisualizer(selectedDoc)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-xs transition-colors shadow-md"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Apply as Dynamic Text</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleRequestExportToGoogleDoc(
                            `PulseWave Setlist - ${new Date().toLocaleDateString()}`,
                            `Theme: ${String(config.theme)}\nMode: ${config.visualizerMode}\nAudio Sync: ${config.textOverlay.syncTarget}\n\nLyrics / Notes:\n${selectedDoc.fullText}`
                          )
                        }
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium text-xs border border-gray-700 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Export Setlist Doc</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-gray-500">
                    Select a document on the left to extract lyrics or setlists.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: GOOGLE KEEP & NOTES */}
      {activeSection === 'keep' && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-white">Google Keep Notes & Lyrics Pad</h4>
            <p className="text-xs text-gray-400">
              Create, tag, and persist song lyrics, visualizer concepts, and Keep-synced notes across devices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Note Creation Form */}
            <form
              onSubmit={handleCreateNote}
              className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3"
            >
              <div className="text-[11px] font-semibold uppercase text-yellow-400 tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>New Lyric / Keep Note</span>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Note Title / Song Title..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  required
                />
              </div>

              <div>
                <textarea
                  rows={4}
                  placeholder="Lyrics, setlist cue, visualizer mood notes..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none font-mono"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={newNoteTag}
                  onChange={(e) => setNewNoteTag(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-300 focus:outline-none"
                >
                  <option value="#lyrics">#lyrics</option>
                  <option value="#visualizer">#visualizer</option>
                  <option value="#setlist">#setlist</option>
                  <option value="#ambient">#ambient</option>
                </select>

                <button
                  type="submit"
                  disabled={!currentUser}
                  className="flex-1 py-1.5 px-3 bg-yellow-600 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  Save Note
                </button>
              </div>
            </form>

            {/* Notes List */}
            <div className="md:col-span-2 p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase text-gray-400 tracking-wider">
                  Saved Notes ({notes.length})
                </div>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => loadUserCloudData(currentUser.uid)}
                    disabled={isLoadingNotes}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNotes ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {notes.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  {currentUser
                    ? 'No notes saved yet. Create your first lyrics note or visualizer cue!'
                    : 'Sign in to save and access your Google Keep & Cloud notes.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-gray-950/80 border border-gray-800 rounded-lg flex flex-col justify-between gap-2 hover:border-yellow-500/30 transition-all group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-semibold text-xs text-yellow-300 truncate">{note.title}</h5>
                          <span className="text-[10px] text-gray-500 uppercase">{note.tags?.[0] || '#keep'}</span>
                        </div>
                        <p className="text-xs text-gray-300 font-mono mt-1 line-clamp-2">{note.content}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-900">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateConfig({
                              textOverlay: {
                                ...config.textOverlay,
                                enabled: true,
                                title: note.title,
                                subtitle: note.content.substring(0, 60),
                              },
                            });
                            showNotification(`Applied note "${note.title}" to Dynamic Text Overlay!`);
                          }}
                          className="flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 font-medium"
                        >
                          <Send className="w-3 h-3" />
                          <span>Use in Visualizer</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleRequestExportToGoogleDoc(note.title, note.content)
                            }
                            title="Export note to Google Doc"
                            className="p-1 text-gray-400 hover:text-blue-400"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNoteConfirm(note.id, note.title)}
                            title="Delete note"
                            className="p-1 text-gray-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: CLOUD PRESETS (FIRESTORE) */}
      {activeSection === 'presets' && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-white">Firestore Cloud Presets</h4>
            <p className="text-xs text-gray-400">
              Save and retrieve your complete visualizer audio profiles, shader configurations, and color palettes securely in the Cloud.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Save current preset */}
            <div className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3">
              <div className="text-[11px] font-semibold uppercase text-indigo-400 tracking-wider">
                Save Current Setup
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Preset Name (e.g., Neon Cyberbass)..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="text-[11px] text-gray-400 space-y-1 bg-gray-950 p-2.5 rounded-lg border border-gray-800/80">
                <div>Theme: <span className="text-indigo-300 font-mono">{String(config.theme)}</span></div>
                <div>Mode: <span className="text-indigo-300 font-mono">{config.visualizerMode}</span></div>
                <div>Intensity: <span className="text-indigo-300 font-mono">{config.effectIntensity.toFixed(1)}x</span></div>
              </div>

              <button
                type="button"
                onClick={handleSaveCurrentPreset}
                disabled={!currentUser || !newPresetName.trim()}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs transition-colors shadow-md disabled:opacity-50"
              >
                Save Preset to Cloud
              </button>
            </div>

            {/* Presets List */}
            <div className="md:col-span-2 p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3">
              <div className="text-[11px] font-semibold uppercase text-gray-400 tracking-wider">
                Saved Cloud Presets ({presets.length})
              </div>

              {presets.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  {currentUser
                    ? 'No presets saved to the cloud yet. Save your current setup above!'
                    : 'Sign in to sync and load your visualizer presets.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {presets.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-gray-950/80 border border-gray-800 rounded-lg flex flex-col justify-between gap-2 hover:border-indigo-500/40 transition-all"
                    >
                      <div>
                        <h5 className="font-semibold text-xs text-indigo-300 truncate">{p.name}</h5>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Theme: {p.theme} • Mode: {p.visualizerMode}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-900">
                        <button
                          type="button"
                          onClick={() => handleApplyPresetItem(p)}
                          className="flex items-center gap-1.5 py-1 px-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded font-medium text-[11px] transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          <span>Load Preset</span>
                        </button>
                        <span className="text-[10px] text-gray-500">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY Confirmation Dialog for Destructive / Mutating Operations */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{confirmModal.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Please confirm to proceed</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-gray-950 p-3 rounded-xl border border-gray-800">
              {confirmModal.description}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-colors"
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
