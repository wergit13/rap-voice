# Video File Share - Implementation Guide

## Component Implementation Details

### 1. useVideoFileShare Hook

**File:** `lib/hooks/useVideoFileShare.ts`

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { LocalVideoTrack, LocalAudioTrack, Track } from 'livekit-client';

interface UseVideoFileShareOptions {
  onError?: (error: Error) => void;
  onTrackPublished?: () => void;
  onTrackUnpublished?: () => void;
}

interface UseVideoFileShareReturn {
  videoElement: HTMLVideoElement | null;
  isSharing: boolean;
  isLoading: boolean;
  error: Error | null;
  videoTrack: LocalVideoTrack | null;
  audioTrack: LocalAudioTrack | null;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  startSharing: () => Promise<void>;
  stopSharing: () => Promise<void>;
}

export function useVideoFileShare(
  options: UseVideoFileShareOptions = {}
): UseVideoFileShareReturn {
  const room = useRoomContext();
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startSharing = useCallback(async () => {
    if (!videoElement) {
      const err = new Error('Video element not ready');
      setError(err);
      options.onError?.(err);
      return;
    }

    if (isSharing) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Ensure video is playing
      if (videoElement.paused) {
        await videoElement.play();
      }

      // Capture stream from video element
      const stream = videoElement.captureStream(30); // 30 fps
      streamRef.current = stream;

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      // Publish video track
      if (videoTracks.length > 0) {
        const videoTrack = await room.localParticipant.publishTrack(videoTracks[0], {
          name: 'shared-video-file',
          source: Track.Source.Camera,
          simulcast: false,
        });
        videoTrackRef.current = videoTrack as LocalVideoTrack;
      }

      // Publish audio track if available
      if (audioTracks.length > 0) {
        const audioTrack = await room.localParticipant.publishTrack(audioTracks[0], {
          name: 'shared-video-audio',
          source: Track.Source.Microphone,
        });
        audioTrackRef.current = audioTrack as LocalAudioTrack;
      }

      setIsSharing(true);
      options.onTrackPublished?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start sharing');
      setError(error);
      options.onError?.(error);
      
      // Cleanup on error
      await stopSharing();
    } finally {
      setIsLoading(false);
    }
  }, [videoElement, isSharing, room, options]);

  const stopSharing = useCallback(async () => {
    try {
      setIsLoading(true);

      // Unpublish tracks
      if (videoTrackRef.current) {
        await room.localParticipant.unpublishTrack(videoTrackRef.current);
        videoTrackRef.current = null;
      }

      if (audioTrackRef.current) {
        await room.localParticipant.unpublishTrack(audioTrackRef.current);
        audioTrackRef.current = null;
      }

      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Pause video element
      if (videoElement && !videoElement.paused) {
        videoElement.pause();
      }

      setIsSharing(false);
      options.onTrackUnpublished?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop sharing');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [videoElement, room, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSharing) {
        stopSharing();
      }
    };
  }, [isSharing, stopSharing]);

  return {
    videoElement,
    isSharing,
    isLoading,
    error,
    videoTrack: videoTrackRef.current,
    audioTrack: audioTrackRef.current,
    setVideoElement,
    startSharing,
    stopSharing,
  };
}
```

### 2. VideoFilePlayer Component

**File:** `lib/components/conference/videoFileShare/VideoFilePlayer.tsx`

```typescript
import * as React from 'react';

export interface VideoFilePlayerProps {
  file: File | null;
  onVideoElementReady: (element: HTMLVideoElement) => void;
  onError?: (error: Error) => void;
  onEnded?: () => void;
  onLoadedMetadata?: (duration: number) => void;
}

export function VideoFilePlayer({
  file,
  onVideoElementReady,
  onError,
  onEnded,
  onLoadedMetadata,
}: VideoFilePlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Notify parent when video element is ready
  React.useEffect(() => {
    if (videoRef.current) {
      onVideoElementReady(videoRef.current);
    }
  }, [onVideoElementReady]);

  // Load file when it changes
  React.useEffect(() => {
    if (!file || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const objectUrl = URL.createObjectURL(file);

    video.src = objectUrl;
    video.load();

    // Cleanup
    return () => {
      URL.revokeObjectURL(objectUrl);
      video.src = '';
    };
  }, [file]);

  const handleError = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const error = video.error;
    let errorMessage = 'Failed to load video file';

    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Video loading was aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading video';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Video decoding failed';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported';
          break;
      }
    }

    onError?.(new Error(errorMessage));
  }, [onError]);

  const handleLoadedMetadata = React.useCallback(() => {
    const video = videoRef.current;
    if (video) {
      onLoadedMetadata?.(video.duration);
    }
  }, [onLoadedMetadata]);

  return (
    <video
      ref={videoRef}
      style={{ display: 'none' }}
      playsInline
      muted={false}
      controls={false}
      onError={handleError}
      onEnded={onEnded}
      onLoadedMetadata={handleLoadedMetadata}
    />
  );
}
```

### 3. VideoFileControls Component

**File:** `lib/components/conference/videoFileShare/VideoFileControls.tsx`

```typescript
import * as React from 'react';

export interface VideoFileControlsProps {
  videoElement: HTMLVideoElement | null;
  disabled?: boolean;
}

export function VideoFileControls({ videoElement, disabled = false }: VideoFileControlsProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  // Sync state with video element
  React.useEffect(() => {
    if (!videoElement) return;

    const updateTime = () => setCurrentTime(videoElement.currentTime);
    const updateDuration = () => setDuration(videoElement.duration);
    const updatePlaying = () => setIsPlaying(!videoElement.paused);

    videoElement.addEventListener('timeupdate', updateTime);
    videoElement.addEventListener('durationchange', updateDuration);
    videoElement.addEventListener('play', updatePlaying);
    videoElement.addEventListener('pause', updatePlaying);
    videoElement.addEventListener('ended', updatePlaying);

    // Initial sync
    setCurrentTime(videoElement.currentTime);
    setDuration(videoElement.duration);
    setIsPlaying(!videoElement.paused);
    setVolume(videoElement.volume);
    setPlaybackRate(videoElement.playbackRate);

    return () => {
      videoElement.removeEventListener('timeupdate', updateTime);
      videoElement.removeEventListener('durationchange', updateDuration);
      videoElement.removeEventListener('play', updatePlaying);
      videoElement.removeEventListener('pause', updatePlaying);
      videoElement.removeEventListener('ended', updatePlaying);
    };
  }, [videoElement]);

  const handlePlayPause = React.useCallback(() => {
    if (!videoElement || disabled) return;

    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  }, [videoElement, disabled]);

  const handleSeek = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoElement || disabled) return;
      const time = parseFloat(e.target.value);
      videoElement.currentTime = time;
      setCurrentTime(time);
    },
    [videoElement, disabled]
  );

  const handleVolumeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoElement || disabled) return;
      const vol = parseFloat(e.target.value);
      videoElement.volume = vol;
      setVolume(vol);
    },
    [videoElement, disabled]
  );

  const handlePlaybackRateChange = React.useCallback(
    (rate: number) => {
      if (!videoElement || disabled) return;
      videoElement.playbackRate = rate;
      setPlaybackRate(rate);
    },
    [videoElement, disabled]
  );

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-file-controls">
      <div className="controls-row">
        <button
          className="lk-button"
          onClick={handlePlayPause}
          disabled={disabled || !videoElement}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="timeline-container">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={disabled || !videoElement}
            className="timeline-slider"
          />
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="volume-container">
          <span>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            disabled={disabled || !videoElement}
            className="volume-slider"
          />
        </div>

        <div className="playback-rate-container">
          <select
            value={playbackRate}
            onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
            disabled={disabled || !videoElement}
            className="playback-rate-select"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```

### 4. VideoFileModal Component

**File:** `lib/components/conference/videoFileShare/VideoFileModal.tsx`

```typescript
import * as React from 'react';
import { VideoFilePlayer } from './VideoFilePlayer';
import { VideoFileControls } from './VideoFileControls';
import { useVideoFileShare } from '@/lib/hooks/useVideoFileShare';

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

      // Validate file size (e.g., max 500MB)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('File size must be less than 500MB');
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
    await stopSharing();
  }, [stopSharing]);

  const handleClose = React.useCallback(() => {
    if (isSharing) {
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
```

### 5. VideoFileShareToggle Component

**File:** `lib/components/conference/controls/VideoFileShareToggle.tsx`

```typescript
import * as React from 'react';
import { useVideoFileShareToggle } from '@/lib/hooks/useVideoFileShareToggle';

export interface VideoFileShareToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSharing?: boolean;
}

export const VideoFileShareToggle = React.forwardRef<
  HTMLButtonElement,
  VideoFileShareToggleProps
>(function VideoFileShareToggle({ isSharing = false, ...props }, ref) {
  const { mergedProps } = useVideoFileShareToggle({ props });

  return (
    <button
      ref={ref}
      {...mergedProps}
      className={`lk-button ${isSharing ? 'lk-button-active' : ''}`}
      aria-label="Share video file"
    >
      {props.children}
    </button>
  );
});
```

### 6. useVideoFileShareToggle Hook

**File:** `lib/hooks/useVideoFileShareToggle.ts`

```typescript
import * as React from 'react';
import { useMaybeLayoutContext } from '@livekit/components-react';

export interface UseVideoFileShareToggleProps {
  props: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export function useVideoFileShareToggle({ props }: UseVideoFileShareToggleProps) {
  const layoutContext = useMaybeLayoutContext();

  const mergedProps = React.useMemo(() => {
    return {
      ...props,
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        props.onClick?.(e);
        layoutContext?.widget.dispatch?.({ msg: 'toggle_video_file_share' });
      },
    };
  }, [props, layoutContext]);

  return { mergedProps };
}
```

## Integration Steps

### Step 1: Update WidgetState Type

First, we need to extend the `WidgetState` type. This might be in the `@livekit/components-core` package. If we can't modify it directly, we'll need to manage the state separately in [`VideoConference.tsx`](lib/components/conference/VideoConference.tsx:62).

### Step 2: Update ControlBar

**File:** [`lib/components/conference/ControlBar.tsx`](lib/components/conference/ControlBar.tsx:17)

```typescript
// Add to imports
import { VideoFileShareToggle } from './controls/VideoFileShareToggle';

// Update ControlBarControls type
export type ControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
  settings?: boolean;
  videoFileShare?: boolean; // NEW
};

// In the component, add after screenShare button (around line 205):
{visibleControls.videoFileShare && (
  <VideoFileShareToggle>
    {showIcon && <span>📹</span>}
    {showText && 'Share Video'}
  </VideoFileShareToggle>
)}
```

### Step 3: Update VideoConference

**File:** [`lib/components/conference/VideoConference.tsx`](lib/components/conference/VideoConference.tsx:62)

```typescript
// Add to imports
import { VideoFileModal } from './videoFileShare/VideoFileModal';

// Update state
const [widgetState, setWidgetState] = React.useState<WidgetState>({
  showChat: false,
  unreadMessages: 0,
  showSettings: false,
  showVideoFileShare: false, // NEW
});

// Update widgetUpdate function to handle new message
const widgetUpdate = (state: WidgetState) => {
  log.debug('updating widget state', state);
  setWidgetState(state);
};

// Add modal rendering before closing LayoutContextProvider (around line 172):
{widgetState.showVideoFileShare && (
  <VideoFileModal
    isOpen={widgetState.showVideoFileShare}
    onClose={() => setWidgetState(prev => ({ ...prev, showVideoFileShare: false }))}
  />
)}

// Update ControlBar to enable videoFileShare
<ControlBar controls={{ chat: true, settings: !!SettingsComponent, videoFileShare: true }} />
```

## Styling

Create a new CSS file or add to existing styles:

**File:** `styles/VideoFileShare.module.css`

```css
.video-file-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.video-file-modal {
  background: var(--lk-bg);
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
  color: var(--lk-fg);
}

.file-input-section {
  margin-bottom: 20px;
}

.selected-file-info {
  margin-top: 12px;
  padding: 12px;
  background: var(--lk-bg2);
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-size {
  color: var(--lk-fg2);
  font-size: 0.9rem;
}

.error-message {
  padding: 12px;
  background: #ff4444;
  color: white;
  border-radius: 4px;
  margin-bottom: 16px;
}

.controls-section {
  margin: 20px 0;
  padding: 16px;
  background: var(--lk-bg2);
  border-radius: 4px;
}

.video-file-controls {
  width: 100%;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-slider {
  width: 100%;
}

.time-display {
  font-size: 0.85rem;
  color: var(--lk-fg2);
  text-align: center;
}

.volume-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-slider {
  width: 80px;
}

.playback-rate-select {
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--lk-bg);
  color: var(--lk-fg);
  border: 1px solid var(--lk-border);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.lk-button-primary {
  background: var(--lk-brand);
  color: white;
}

.lk-button-danger {
  background: #ff4444;
  color: white;
}

.lk-button-active {
  background: var(--lk-brand);
  color: white;
}
```

## Testing Checklist

- [ ] File selection works correctly
- [ ] Video loads and plays in hidden element
- [ ] Stream capture works (check browser console)
- [ ] Tracks publish to LiveKit room
- [ ] Other participants can see the shared video
- [ ] Play/pause controls work
- [ ] Seek/timeline works
- [ ] Volume control works
- [ ] Playback speed control works
- [ ] Stop sharing unpublishes tracks correctly
- [ ] Modal closes properly
- [ ] Error handling for invalid files
- [ ] Error handling for unsupported formats
- [ ] Loading states display correctly
- [ ] Works on different browsers (Chrome, Firefox, Safari)
- [ ] Responsive design on mobile devices

## Common Issues and Solutions

### Issue 1: captureStream not available
**Solution:** Check browser compatibility and provide fallback message

### Issue 2: Video doesn't play automatically
**Solution:** Ensure user interaction before calling play(), or handle autoplay policies

### Issue 3: Audio not captured
**Solution:** Check video file has audio track, verify muted=false on video element

### Issue 4: Tracks not visible to other participants
**Solution:** Verify track publishing options, check room permissions

### Issue 5: Performance issues with large files
**Solution:** Add file size validation, consider compression or streaming options

## Next Steps for Phase 2

1. **RPC Functionality for Shared Controls:**
   - Implement LiveKit RPC to sync playback controls
   - Allow host to control playback for all participants
   - Add permission system for who can control

2. **Full Screen Mode:**
   - Add full screen button to controls
   - Handle full screen API
   - Maintain controls visibility in full screen

3. **Additional Features:**
   - Video preview before sharing
   - Drag & drop file upload
   - Multiple file queue
   - Loop option
   - Synchronized playback timing