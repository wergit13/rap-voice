# Widget State Integration for Video File Share

## Challenge: Extending WidgetState

The `WidgetState` type is defined in `@livekit/components-core` package and is used by the layout context system. We need to add `showVideoFileShare` property to track the modal visibility.

## Solution Options

### Option 1: Type Extension (Recommended)

Extend the `WidgetState` type locally using TypeScript declaration merging:

**File:** `lib/types/widget-state.d.ts` (new file)

```typescript
import '@livekit/components-core';

declare module '@livekit/components-core' {
  interface WidgetState {
    showVideoFileShare?: boolean;
  }
}
```

Then in [`VideoConference.tsx`](lib/components/conference/VideoConference.tsx:62):

```typescript
const [widgetState, setWidgetState] = React.useState<WidgetState>({
  showChat: false,
  unreadMessages: 0,
  showSettings: false,
  showVideoFileShare: false, // Now TypeScript recognizes this
});
```

### Option 2: Separate State Management

If type extension doesn't work, manage the modal state separately:

**File:** [`lib/components/conference/VideoConference.tsx`](lib/components/conference/VideoConference.tsx:62)

```typescript
const [widgetState, setWidgetState] = React.useState<WidgetState>({
  showChat: false,
  unreadMessages: 0,
  showSettings: false,
});

// Separate state for video file share modal
const [showVideoFileShare, setShowVideoFileShare] = React.useState(false);

// Custom handler for video file share toggle
const handleVideoFileShareToggle = React.useCallback(() => {
  setShowVideoFileShare(prev => !prev);
}, []);
```

Then pass the handler via context or props to the toggle button.

### Option 3: Custom Layout Context Wrapper

Create a wrapper that extends the layout context functionality:

**File:** `lib/contexts/ExtendedLayoutContext.tsx` (new file)

```typescript
import * as React from 'react';
import { LayoutContextProvider, useCreateLayoutContext } from '@livekit/components-react';
import type { LayoutContextType } from '@livekit/components-core';

interface ExtendedWidgetState {
  showVideoFileShare: boolean;
}

interface ExtendedLayoutContextType extends LayoutContextType {
  extendedWidget: {
    state: ExtendedWidgetState;
    dispatch?: (action: { msg: string }) => void;
  };
}

const ExtendedLayoutContext = React.createContext<ExtendedLayoutContextType | undefined>(
  undefined
);

export function useExtendedLayoutContext() {
  const context = React.useContext(ExtendedLayoutContext);
  if (!context) {
    throw new Error('useExtendedLayoutContext must be used within ExtendedLayoutContextProvider');
  }
  return context;
}

export function ExtendedLayoutContextProvider({ children }: { children: React.ReactNode }) {
  const baseLayoutContext = useCreateLayoutContext();
  const [extendedState, setExtendedState] = React.useState<ExtendedWidgetState>({
    showVideoFileShare: false,
  });

  const extendedWidget = React.useMemo(
    () => ({
      state: extendedState,
      dispatch: (action: { msg: string }) => {
        if (action.msg === 'toggle_video_file_share') {
          setExtendedState(prev => ({
            ...prev,
            showVideoFileShare: !prev.showVideoFileShare,
          }));
        }
      },
    }),
    [extendedState]
  );

  const extendedContext: ExtendedLayoutContextType = {
    ...baseLayoutContext,
    extendedWidget,
  };

  return (
    <ExtendedLayoutContext.Provider value={extendedContext}>
      <LayoutContextProvider value={baseLayoutContext}>{children}</LayoutContextProvider>
    </ExtendedLayoutContext.Provider>
  );
}
```

## Recommended Approach: Option 2 (Separate State)

For simplicity and to avoid potential conflicts with the LiveKit library updates, **Option 2** is recommended. Here's the complete implementation:

### Updated VideoConference Component

**File:** [`lib/components/conference/VideoConference.tsx`](lib/components/conference/VideoConference.tsx:55)

```typescript
import type {
  MessageDecoder,
  MessageEncoder,
  TrackReferenceOrPlaceholder,
  WidgetState,
} from '@livekit/components-core';
import { isEqualTrackRef, isTrackReference, isWeb, log } from '@livekit/components-core';
import { RoomEvent, Track } from 'livekit-client';
import * as React from 'react';
import type { MessageFormatter } from '@livekit/components-react';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { useCreateLayoutContext } from '@livekit/components-react';
import { usePinnedTracks, useTracks } from '@livekit/components-react';
import { Chat } from '@livekit/components-react';
import { ControlBar } from './ControlBar';
import { VideoFileModal } from './videoFileShare/VideoFileModal'; // NEW

/**
 * @public
 */
export interface VideoConferenceProps extends React.HTMLAttributes<HTMLDivElement> {
  chatMessageFormatter?: MessageFormatter;
  chatMessageEncoder?: MessageEncoder;
  chatMessageDecoder?: MessageDecoder;
  /** @alpha */
  SettingsComponent?: React.ComponentType;
}

/**
 * Context for video file share modal state
 */
const VideoFileShareContext = React.createContext<{
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

export function VideoConference({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  ...props
}: VideoConferenceProps) {
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  
  // Separate state for video file share modal
  const [showVideoFileShare, setShowVideoFileShare] = React.useState(false);
  
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const widgetUpdate = (state: WidgetState) => {
    log.debug('updating widget state', state);
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      log.debug('Auto set screen share focus:', { newScreenShareTrack: screenShareTracks[0] });
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      log.debug('Auto clearing screen share focus.');
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  }, [
    screenShareTracks
      .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  // Video file share context value
  const videoFileShareContextValue = React.useMemo(
    () => ({
      isOpen: showVideoFileShare,
      toggle: () => setShowVideoFileShare(prev => !prev),
    }),
    [showVideoFileShare]
  );

  return (
    <div className="lk-video-conference" {...props}>
      {isWeb() && (
        <VideoFileShareContext.Provider value={videoFileShareContextValue}>
          <LayoutContextProvider
            value={layoutContext}
            onWidgetChange={widgetUpdate}
          >
            <div className="lk-video-conference-inner">
              {!focusTrack ? (
                <div className="lk-grid-layout-wrapper">
                  <GridLayout tracks={tracks}>
                    <ParticipantTile />
                  </GridLayout>
                </div>
              ) : (
                <div className="lk-focus-layout-wrapper">
                  <FocusLayoutContainer>
                    <CarouselLayout tracks={carouselTracks}>
                      <ParticipantTile />
                    </CarouselLayout>
                    {focusTrack && <FocusLayout trackRef={focusTrack} />}
                  </FocusLayoutContainer>
                </div>
              )}
              <ControlBar 
                controls={{ 
                  chat: true, 
                  settings: !!SettingsComponent,
                  videoFileShare: true, // Enable video file share control
                }} 
              />
            </div>
            <Chat
              style={{ display: widgetState.showChat ? 'grid' : 'none' }}
              messageFormatter={chatMessageFormatter}
              messageEncoder={chatMessageEncoder}
              messageDecoder={chatMessageDecoder}
            />
            {SettingsComponent && (
              <div
                className="lk-settings-menu-modal"
                style={{ display: widgetState.showSettings ? 'block' : 'none' }}
              >
                <SettingsComponent />
              </div>
            )}
            {/* Video File Share Modal */}
            <VideoFileModal
              isOpen={showVideoFileShare}
              onClose={() => setShowVideoFileShare(false)}
            />
          </LayoutContextProvider>
        </VideoFileShareContext.Provider>
      )}
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
```

### Updated VideoFileShareToggle Hook

**File:** `lib/hooks/useVideoFileShareToggle.ts`

```typescript
import * as React from 'react';
import { useVideoFileShareContext } from '@/lib/components/conference/VideoConference';

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
```

## Benefits of This Approach

1. **No Library Modifications:** Doesn't require modifying or extending types from `@livekit/components-core`
2. **Clean Separation:** Video file share state is managed independently
3. **Type Safety:** Full TypeScript support without complex type gymnastics
4. **Easy to Maintain:** Changes to LiveKit library won't break our implementation
5. **Testable:** Easy to test the modal state management in isolation

## Alternative: Using Layout Context Dispatch

If you prefer to use the existing layout context dispatch system, you can intercept messages:

```typescript
const widgetUpdate = (state: WidgetState) => {
  log.debug('updating widget state', state);
  setWidgetState(state);
};

// Wrap the layout context to intercept custom messages
const wrappedLayoutContext = React.useMemo(() => {
  const originalDispatch = layoutContext.widget.dispatch;
  
  return {
    ...layoutContext,
    widget: {
      ...layoutContext.widget,
      dispatch: (action: any) => {
        if (action.msg === 'toggle_video_file_share') {
          setShowVideoFileShare(prev => !prev);
        } else {
          originalDispatch?.(action);
        }
      },
    },
  };
}, [layoutContext]);
```

However, this approach is more complex and the separate context approach is cleaner.

## Summary

The recommended implementation uses:
- **Separate state** for video file share modal (`showVideoFileShare`)
- **React Context** to share the state and toggle function
- **Custom hook** (`useVideoFileShareContext`) to access the context
- **No modifications** to LiveKit library types

This approach is clean, maintainable, and won't conflict with future LiveKit updates.