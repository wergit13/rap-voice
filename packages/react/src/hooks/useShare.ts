import * as React from 'react';
import { VideoFilePlayer } from '../components/VideoFilePlayer';

export enum ShareType {
  SCREEN = 'screen',
  VIDEO = 'video',
}

export interface VideoControlsState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  handlePlayPause: () => void;
  handleSeek: (time: number) => void;
  handleVolumeChange: (volume: number) => void;
  handlePlaybackRateChange: (rate: number) => void;
}

export interface ShareContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  isSharing: boolean;
  activeType: ShareType | null;

  setSharing: (sharing: boolean, type?: ShareType) => void;
  setStopHandler: (fn: null | (() => Promise<void>)) => void;
  stop: () => Promise<void>;

  // Video file sharing state
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  videoElement: HTMLVideoElement | null;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;

  // Video playback controls (only available when activeType === 'video')
  videoControls: VideoControlsState | null;
}

const ShareContext = React.createContext<ShareContextValue | null>(null);

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const [activeType, setActiveType] = React.useState<ShareType | null>(null);
  const stopHandlerRef = React.useRef<null | (() => Promise<void>)>(null);

  // Video file sharing state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [videoElement, setVideoElement] = React.useState<HTMLVideoElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Video playback control state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  const open = React.useCallback(() => {
    setIsOpen(true);
  }, []);
  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);
  const toggle = React.useCallback(() => setIsOpen((v) => !v), []);

  const setStopHandler = React.useCallback((fn: null | (() => Promise<void>)) => {
    stopHandlerRef.current = fn;
  }, []);

  const setSharing = React.useCallback((sharing: boolean, type?: ShareType) => {
    setIsSharing(sharing);
    if (sharing) {
      setActiveType(type ?? null);
    } else {
      setActiveType(null);
    }
  }, []);

  const stop = React.useCallback(async () => {
    if (stopHandlerRef.current) {
      try {
        await stopHandlerRef.current();
      } catch {
        // ignore
      }
    }
    setIsSharing(false);
    console.log('stop called', activeType);
    if (activeType === ShareType.VIDEO) {
      console.log('clear video on stop');
      setSelectedFile(null);
      setVideoElement(null);
    }
    setActiveType(null);
  }, [activeType]);

  // Sync video element state with React state
  React.useEffect(() => {
    if (!videoElement || activeType !== 'video') return;

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
  }, [videoElement, activeType]);

  // Video control handlers
  const handlePlayPause = React.useCallback(() => {
    if (!videoElement) return;
    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  }, [videoElement]);

  const handleSeek = React.useCallback(
    (time: number) => {
      if (!videoElement) return;
      videoElement.currentTime = time;
      setCurrentTime(time);
    },
    [videoElement],
  );

  const handleVolumeChange = React.useCallback(
    (vol: number) => {
      if (!videoElement) return;
      videoElement.volume = vol;
      setVolume(vol);
    },
    [videoElement],
  );

  const handlePlaybackRateChange = React.useCallback(
    (rate: number) => {
      if (!videoElement) return;
      videoElement.playbackRate = rate;
      setPlaybackRate(rate);
    },
    [videoElement],
  );

  // Create videoControls object only when video is being shared
  const videoControls = React.useMemo<VideoControlsState | null>(() => {
    if (activeType !== 'video' || !videoElement) return null;

    return {
      isPlaying,
      currentTime,
      duration,
      volume,
      playbackRate,
      handlePlayPause,
      handleSeek,
      handleVolumeChange,
      handlePlaybackRateChange,
    };
  }, [
    activeType,
    videoElement,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    handlePlaybackRateChange,
  ]);

  const value = React.useMemo<ShareContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      isSharing,
      activeType,
      setSharing,
      setStopHandler,
      stop,
      selectedFile,
      setSelectedFile,
      videoElement,
      setVideoElement,
      fileInputRef,
      videoControls,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      isSharing,
      activeType,
      setSharing,
      setStopHandler,
      stop,
      selectedFile,
      videoElement,
      videoControls,
    ],
  );

  return React.createElement(
    ShareContext.Provider,
    { value },
    React.createElement('input', {
      ref: fileInputRef,
      type: 'file',
      accept: 'video/*',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
          setSelectedFile(file);
        }
      },
      style: { display: 'none' },
    }),
    selectedFile &&
      React.createElement(VideoFilePlayer, {
        file: selectedFile,
        onVideoElementReady: setVideoElement,
        onError: (err: Error) => console.error('Video player error:', err),
      }),
    children,
  );
}

export function useShare(): ShareContextValue {
  const ctx = React.useContext(ShareContext);
  if (!ctx) {
    throw new Error('useShare must be used within ShareProvider');
  }
  return ctx;
}
