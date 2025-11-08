import * as React from 'react';
import { Track } from 'livekit-client';
import { useShare } from '../hooks/useShare';
import { useTrackToggle } from '../hooks';
import { VideoFilePlayer } from './VideoFilePlayer';
import { useVideoFileShare } from '../hooks/useVideoFileShare';

function Tabs(props: React.PropsWithChildren<{}>) {
const [tabIndex, setTabIndex] = React.useState(0);

  let tabs = React.Children.map(props.children, (child, index) => {
    return (
      <button
        className="lk-button"
        onClick={() => {setTabIndex(index);}}
        aria-pressed={tabIndex === index}
      >
        {/* @ts-ignore */}
        {child?.props.label}
      </button>
    );
  });

  return (
    <div className="lk-tab-container">
      <div className="lk-tab-select">{tabs}</div>
      {/* @ts-ignore */}
      {props.children[tabIndex]}
    </div>
  );
}

export function ShareModal() {
  const { isOpen } = useShare();

  const classes = isOpen ? "lk-share-modal" : "lk-share-modal-hidden";

  return (     
    <div className={classes} onClick={(e) => e.stopPropagation()}> 
    <Tabs>
      <ScreenShareTab label="Screen" />
      <VideoShareTab label="Video file" />
    </Tabs>
    </div>
  );
}

function ScreenShareTab(props: { label: string }) {
  const { setSharing, setStopHandler, close } = useShare();

  const { buttonProps, enabled, toggle } = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true, selfBrowserSurface: 'include' },
    onChange: (isEnabled: boolean) => {
      if (isEnabled) {
        setSharing(true, 'screen');
        setStopHandler(() => toggle(false).then(() => {}));
        close();
      } else {
        setSharing(false, null);
        setStopHandler(null);
      }
    },
  });

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button {...buttonProps} className="lk-button lk-button-primary">
        {enabled ? 'Stop screen share' : 'Start screen share'}
      </button>
    </div>
  );
}

function VideoShareTab( props: {label: string}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const { setSharing, setStopHandler, close } = useShare();

  const {
    videoElement,
    isSharing,
    isLoading,
    error: shareError,
    setVideoElement,
    startSharing,
    stopSharing,
  } = useVideoFileShare({
    onError: (err) => setLocalError(err.message),
    onTrackPublished: () => setLocalError(null),
  });

  const handleFileSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setLocalError('Please select a valid video file');
      return;
    }
    setSelectedFile(file);
    setLocalError(null);
  }, []);

  const handleStart = React.useCallback(async () => {
    if (!selectedFile) {
      setLocalError('Please select a video file first');
      return;
    }
    await startSharing();
    setSharing(true, 'video');
    setStopHandler(() => stopSharing());
    // close();
  }, [selectedFile, startSharing, stopSharing, setSharing, setStopHandler, close]);

  return (
    <div className="video-share-tab">
      <div className="file-input-section">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button className="lk-button" onClick={() => fileInputRef.current?.click()} disabled={isSharing}>
          Choose Video File
        </button>
        {selectedFile && (
          <div className="selected-file-info">
            <span>📹 {selectedFile.name}</span>
            <span className="file-size">({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
          </div>
        )}
      </div>

      {(localError || shareError) && (
        <div className="error-message">⚠️ {localError || shareError?.message}</div>
      )}

      {selectedFile && (
        <VideoFilePlayer
          file={selectedFile}
          onVideoElementReady={setVideoElement}
          onError={(err) => setLocalError(err.message)}
        />
      )}

      <div className="modal-actions">
        <button
          className="lk-button lk-button-primary"
          onClick={handleStart}
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? 'Starting...' : 'Start Sharing'}
        </button>
      </div>
    </div>
  );
}