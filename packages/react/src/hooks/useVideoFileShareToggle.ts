import * as React from 'react';

// This will be provided by VideoConference component
export const VideoFileShareContext = React.createContext<{
  isOpen: boolean;
  toggle: () => void;
} | null>(null);

export function useVideoFileShareContext() {
  const context = React.useContext(VideoFileShareContext);
  if (!context) {
    throw new Error('useVideoFileShareContext must be used within VideoConference');
  }
  return context;
}

export interface UseVideoFileShareToggleProps {
  props: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export function useVideoFileShareToggle({ props }: UseVideoFileShareToggleProps) {
  const videoFileShareContext = useVideoFileShareContext();

  const mergedProps = React.useMemo(() => {
    return {
      ...props,
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        props.onClick?.(e);
        videoFileShareContext.toggle();
      },
    };
  }, [props, videoFileShareContext]);

  return { mergedProps };
}