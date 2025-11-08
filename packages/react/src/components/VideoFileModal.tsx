import * as React from 'react';
import { VideoFilePlayer } from './VideoFilePlayer';
import { VideoFileControls } from './VideoFileControls';
import { useVideoFileShare } from '../hooks/useVideoFileShare';

export interface VideoFileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoFileModal({ isOpen, onClose }: VideoFileModalProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    videoElement,
    isSharing,
    isLoading,
    error: shareError,
    setVideoElement,
    startSharing,
    stopSharing,
  } = useVideoFileShare({
    onError: (err) => setError(err.message),
    onTrackPublished: () => setError(null),
  });

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }

      setSelectedFile(file);
      setError(null);
    },
    []
  );

  const handleStartSharing = React.useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a video file first');
      return;
    }
    await startSharing();
  }, [selectedFile, startSharing]);

  const handleStopSharing = React.useCallback(async () => {
    console.log('stop sharing 3');
    await stopSharing();
  }, [stopSharing]);

  const handleClose = React.useCallback(() => {
    if (isSharing) {
      console.log('stop sharing 4');
      stopSharing();
    }
    setSelectedFile(null);
    setError(null);
    onClose();
  }, [isSharing, stopSharing, onClose]);

  if (!isOpen) return null;

  return (
    <div className="video-file-modal-overlay" onClick={handleClose}>
      <div className="video-file-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share Video File</h2>
          <button className="close-button" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-content">
          {/* File Input */}
          <div className="file-input-section">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              className="lk-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSharing}
            >
              Choose Video File
            </button>
            {selectedFile && (
              <div className="selected-file-info">
                <span>📹 {selectedFile.name}</span>
                <span className="file-size">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
            )}
          </div>

          {/* Error Display */}
          {(error || shareError) && (
            <div className="error-message">
              ⚠️ {error || shareError?.message}
            </div>
          )}

          {/* Video Player (hidden) */}
          {selectedFile && (
            <VideoFilePlayer
              file={selectedFile}
              onVideoElementReady={setVideoElement}
              onError={(err) => setError(err.message)}
            />
          )}

          {/* Controls */}
          {selectedFile && videoElement && (
            <div className="controls-section">
              <VideoFileControls videoElement={videoElement} disabled={!isSharing} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="modal-actions">
            {!isSharing ? (
              <button
                className="lk-button lk-button-primary"
                onClick={handleStartSharing}
                disabled={!selectedFile || isLoading}
              >
                {isLoading ? 'Starting...' : 'Start Sharing'}
              </button>
            ) : (
              <button
                className="lk-button lk-button-danger"
                onClick={handleStopSharing}
                disabled={isLoading}
              >
                {isLoading ? 'Stopping...' : 'Stop Sharing'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}