import * as React from 'react';
import { VideoFilePlayer } from '../components/VideoFilePlayer';
import { useVideoControls, VideoControlsState } from './useVideoControls';
import { useRoomContext } from '../context';

export enum ShareType {
  SCREEN = 'screen',
  VIDEO = 'video',
}

export type { VideoControlsState };

export interface ShareContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  activeType: ShareType | null;

  setSharing: (type: ShareType | null) => void;
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
  const [activeType, setActiveType] = React.useState<ShareType | null>(null);
  const stopHandlerRef = React.useRef<null | (() => Promise<void>)>(null);

  // Video file sharing state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [videoElement, setVideoElement] = React.useState<HTMLVideoElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const setSharing = React.useCallback((type: ShareType | null) => {
    setActiveType(type ?? null);
  }, []);

  const stop = React.useCallback(async () => {
    if (stopHandlerRef.current) {
      try {
        await stopHandlerRef.current();
      } catch {
        // ignore
      }
    }
    console.log('stop called', activeType);
    if (activeType === ShareType.VIDEO) {
      console.log('clear video on stop');
      setSelectedFile(null);
      setVideoElement(null);
    }
    setActiveType(null);
  }, [activeType]);

  // Use video controls hook
  const room = useRoomContext();
  const videoControls = useVideoControls({
    videoElement: videoElement,
    videoSharingActive: activeType === ShareType.VIDEO,
    room: room,
  });

  const value = React.useMemo<ShareContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
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
