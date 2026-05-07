// Mic / pause / stop button cluster for the Dictation feature.
// Pure view; the parent owns all state.

import { Button } from "@/components/ui/button";
import { Mic, MicOff, Pause, Play, Square } from "lucide-react";

function ListeningBars() {
  return (
    <div className="flex items-end gap-1 h-10">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="bar w-1 bg-foreground rounded-full"
          style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

function ListeningButtons({ onPause, onStop }: { onPause: () => void; onStop: () => void }) {
  return (
    <>
      <Button
        onClick={onPause}
        size="lg"
        variant="outline"
        className="rounded-full h-12 w-12 p-0"
        title="Pause"
        aria-label="Pause recording"
      >
        <Pause className="h-5 w-5" />
      </Button>
      <Button
        onClick={onStop}
        size="lg"
        variant="destructive"
        className="rounded-full h-16 w-16 p-0"
        title="Stop"
        aria-label="Stop recording"
      >
        <Square className="h-5 w-5 fill-current" />
      </Button>
    </>
  );
}

function PausedButtons({
  disabled,
  onResume,
  onDiscard,
}: {
  disabled: boolean;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <>
      <Button
        onClick={onResume}
        size="lg"
        disabled={disabled}
        className="rounded-full h-16 w-16 p-0"
        title="Resume"
        aria-label="Resume recording"
      >
        <Play className="h-6 w-6" />
      </Button>
      <Button
        onClick={onDiscard}
        size="lg"
        variant="outline"
        className="rounded-full h-12 w-12 p-0"
        title="Discard & reset"
        aria-label="Discard and reset"
      >
        <Square className="h-4 w-4" />
      </Button>
    </>
  );
}

function IdleButton({
  disabled,
  denied,
  onStart,
}: {
  disabled: boolean;
  denied: boolean;
  onStart: () => void;
}) {
  return (
    <Button
      onClick={onStart}
      size="lg"
      disabled={disabled}
      className="rounded-full h-16 w-16 p-0"
      title="Start dictation"
      aria-label="Start dictation"
    >
      {denied ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
    </Button>
  );
}

export function DictationControls({
  isConnected,
  starting,
  paused,
  micState,
  denied,
  onStart,
  onStop,
  onPause,
  onResume,
  onDiscard,
}: {
  isConnected: boolean;
  starting: boolean;
  paused: boolean;
  micState: string;
  denied: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const disabled = starting || micState === "unsupported";
  return (
    <div className="flex items-center justify-center gap-4">
      {isConnected ? (
        <ListeningButtons onPause={onPause} onStop={onStop} />
      ) : paused ? (
        <PausedButtons disabled={disabled} onResume={onResume} onDiscard={onDiscard} />
      ) : (
        <IdleButton disabled={disabled} denied={denied} onStart={onStart} />
      )}
      {isConnected && <ListeningBars />}
    </div>
  );
}
