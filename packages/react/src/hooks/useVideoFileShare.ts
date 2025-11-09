import { useCallback, useRef, useState } from 'react';
import { useRoomContext } from '../context';
import { Track, LocalTrackPublication } from 'livekit-client';

interface UseVideoFileShareOptions {
  videoElement?: HTMLVideoElement | null;
  onError?: (error: Error) => void;
  onTrackPublished?: () => void;
  onTrackUnpublished?: () => void;
}

interface UseVideoFileShareReturn {
  isSharing: boolean;
  isLoading: boolean;
  error: Error | null;
  videoTrack: LocalTrackPublication | null;
  audioTracks: LocalTrackPublication[] | null;
  startSharing: () => Promise<void>;
  stopSharing: () => Promise<void>;
}

// Extend HTMLVideoElement to include captureStream
interface HTMLVideoElementWithCapture extends HTMLVideoElement {
  captureStream(frameRate?: number): MediaStream;
}

export function useVideoFileShare(options: UseVideoFileShareOptions = {}): UseVideoFileShareReturn {
  const room = useRoomContext();
  const { videoElement } = options;
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const videoTrackRef = useRef<LocalTrackPublication | null>(null);
  const audioTracksRef = useRef<LocalTrackPublication[] | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopSharing = useCallback(async () => {
    try {
      setIsLoading(true);

      // Unpublish tracks
      if (videoTrackRef.current?.track) {
        await room.localParticipant.unpublishTrack(videoTrackRef.current.track);
        videoTrackRef.current = null;
      }

      if (audioTracksRef.current) {
        for (const audioTrackRef of audioTracksRef.current) {
          if (audioTrackRef.track) {
            await room.localParticipant.unpublishTrack(audioTrackRef.track);
          }
        }
        audioTracksRef.current = null;
      }

      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Keep video element playing with audio for local playback
      // Don't pause it - just stop publishing

      setIsSharing(false);
      options.onTrackUnpublished?.();
      if (videoElement) {
        videoElement.pause();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop sharing');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [videoElement, room, options]);

  const startSharing = useCallback(async () => {
    console.log('Start video file sharing', videoElement);
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

      // CRITICAL: Unmute and set volume BEFORE playing
      videoElement.muted = false;
      videoElement.volume = 1.0;

      // Ensure video is playing
      if (videoElement.paused) {
        await videoElement.play();
      }

      // // Small delay to ensure video is actually playing
      // await new Promise(resolve => setTimeout(resolve, 100));

      // Capture stream from video element (this should NOT prevent local audio playback)
      const stream = (videoElement as HTMLVideoElementWithCapture).captureStream(30);
      streamRef.current = stream;

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      console.log('Video tracks:', videoTracks.length, 'Audio tracks:', audioTracks.length);
      console.log('Video element muted:', videoElement.muted, 'volume:', videoElement.volume);

      // Publish video track
      if (videoTracks.length > 0) {
        const videoTrack = await room.localParticipant.publishTrack(videoTracks[0], {
          name: 'shared-video-file',
          source: Track.Source.ScreenShare,
          simulcast: false,
          stream: stream.id,
        });
        videoTrackRef.current = videoTrack;
      }

      // Publish audio track if available
      if (audioTracks.length > 0) {
        audioTracksRef.current = [];
        for (const rawAudioTrack of audioTracks) {
          const audioTrack = await room.localParticipant.publishTrack(rawAudioTrack, {
            name: 'shared-video-audio',
            source: Track.Source.Unknown,
            stream: stream.id,
          });
          audioTracksRef.current?.push(audioTrack);
        }
      }

      setIsSharing(true);
      options.onTrackPublished?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start sharing');
      console.error(error);
      setError(error);
      options.onError?.(error);

      // Cleanup on error
      await stopSharing();
    } finally {
      setIsLoading(false);
    }
  }, [videoElement, isSharing, room, options, stopSharing]);

  return {
    isSharing,
    isLoading,
    error,
    videoTrack: videoTrackRef.current,
    audioTracks: audioTracksRef.current,
    startSharing,
    stopSharing,
  };
}
