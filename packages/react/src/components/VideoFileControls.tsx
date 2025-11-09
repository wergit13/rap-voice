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
    [videoElement, disabled],
  );

  const handleVolumeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoElement || disabled) return;
      const vol = parseFloat(e.target.value);
      videoElement.volume = vol;
      setVolume(vol);
    },
    [videoElement, disabled],
  );

  const handlePlaybackRateChange = React.useCallback(
    (rate: number) => {
      if (!videoElement || disabled) return;
      videoElement.playbackRate = rate;
      setPlaybackRate(rate);
    },
    [videoElement, disabled],
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
