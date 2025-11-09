import * as React from 'react';
import { ShareType } from './useShare';
import { Room, RpcInvocationData } from 'livekit-client';

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

interface UseVideoControlsOptions {
  videoElement: HTMLVideoElement | null;
  videoSharingActive: boolean;
  room: Room;
}

const PAUSE_STREAM_METHOD = 'PausePlayStream';
const SEEK_STREAM_METHOD = 'SeekStream';

export function useVideoControls({
  videoElement,
  videoSharingActive,
  room,
}: UseVideoControlsOptions): VideoControlsState | null {
  // Video playback control state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  // Sync video element state with React state
  React.useEffect(() => {
    if (!videoElement || !videoSharingActive) {
      console.log('Unregistering RPC methods for streaming');
      room.unregisterRpcMethod(PAUSE_STREAM_METHOD);
      room.unregisterRpcMethod(SEEK_STREAM_METHOD);
      return;
    }
    const updateTime = () => setCurrentTime(videoElement.currentTime);
    const updateDuration = () => setDuration(videoElement.duration);
    const updatePlaying = () => setIsPlaying(!videoElement.paused);

    videoElement.addEventListener('timeupdate', updateTime);
    videoElement.addEventListener('durationchange', updateDuration);
    videoElement.addEventListener('play', updatePlaying);
    videoElement.addEventListener('pause', updatePlaying);
    videoElement.addEventListener('ended', updatePlaying);

    console.log('Register methods');
    room.registerRpcMethod(PAUSE_STREAM_METHOD, async (_: RpcInvocationData) => {
      setIsPlaying(!isPlaying);
      return String(isPlaying);
    });

    room.registerRpcMethod(SEEK_STREAM_METHOD, async (data: RpcInvocationData) => {
      const offset = Number(data.payload);
      setCurrentTime(Math.min(Math.max(0, currentTime + offset), duration));
      return String(currentTime);
    });

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
  }, [videoElement, videoSharingActive]);

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
    if (!videoSharingActive || !videoElement) return null;

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
    videoSharingActive,
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

  return videoControls;
}
