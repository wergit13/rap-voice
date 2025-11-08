import * as React from 'react';
import { useVideoFileShareToggle } from '../../hooks/useVideoFileShareToggle';

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