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
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        left: '-9999px',
        visibility: 'hidden',
      }}
      playsInline
      muted={false}
      controls={false}
      onError={handleError}
      onEnded={onEnded}
      onLoadedMetadata={handleLoadedMetadata}
    />
  );
}