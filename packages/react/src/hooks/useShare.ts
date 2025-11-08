import * as React from 'react';

export type ShareType = 'screen' | 'video' | null;

export interface ShareContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  isSharing: boolean;
  activeType: ShareType;

  setSharing: (sharing: boolean, type?: ShareType) => void;
  setStopHandler: (fn: null | (() => Promise<void>)) => void;
  stop: () => Promise<void>;
}

const ShareContext = React.createContext<ShareContextValue | null>(null);

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const [activeType, setActiveType] = React.useState<ShareType>(null);
  const stopHandlerRef = React.useRef<null | (() => Promise<void>)>(null);

  const open = React.useCallback(() => {setIsOpen(true);}, []);
  const close = React.useCallback(() => {setIsOpen(false);}, []);
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
    setActiveType(null);
  }, []);

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
    }),
    [isOpen, open, close, toggle, isSharing, activeType, setSharing, setStopHandler, stop],
  );

  return React.createElement(ShareContext.Provider, { value }, children);
}

export function useShare(): ShareContextValue {
  const ctx = React.useContext(ShareContext);
  if (!ctx) {
    throw new Error('useShare must be used within ShareProvider');
  }
  return ctx;
}