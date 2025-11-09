import * as React from 'react';
import { useShare } from '../../hooks/useShare';
import ScreenShareIcon from '../../assets/icons/ScreenShareIcon';
import ScreenShareStopIcon from '../../assets/icons/ScreenShareStopIcon';

export interface ShareToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showIcon?: boolean;
  showText?: boolean;
}

export const ShareToggle = React.forwardRef<HTMLButtonElement, ShareToggleProps>(
  function ShareToggle(
    { showIcon = true, showText = false, className, children, onClick, ...rest },
    ref,
  ) {
    const { isOpen, activeType, open, stop, close } = useShare();

    const handleClick = React.useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        e.stopPropagation();
        if (activeType) {
          await stop();
        } else if (isOpen) {
          await close();
        } else {
          await open();
        }
      },
      [onClick, activeType, stop, isOpen, open, close],
    );

    const label = activeType !== null ? 'Stop share' : 'Share';
    const classes =
      `lk-button ${activeType !== null ? 'lk-button-active' : ''} ${className ?? ''}`.trim();

    return (
      <button
        ref={ref}
        {...rest}
        id="lk-share-toggle"
        className={classes}
        aria-pressed={isOpen}
        aria-label={label}
        onClick={handleClick}
      >
        {showIcon && (activeType !== null ? <ScreenShareStopIcon /> : <ScreenShareIcon />)}
        {showText ? label : children}
      </button>
    );
  },
);
