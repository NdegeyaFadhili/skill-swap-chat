
import { Button } from "@/components/ui/button";
import { useRef, useEffect } from "react";

interface MediaRoomProps {
  type: 'video' | 'audio';
  stream: MediaStream | null;
  peerStream: MediaStream | null;
  deviceError: string | null;
  isLearner: boolean;
  onToggleStream: () => void;
}

export function MediaRoom({ 
  type, 
  stream, 
  peerStream, 
  deviceError,
  isLearner,
  onToggleStream 
}: MediaRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && type === 'video' && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream, type]);

  useEffect(() => {
    if (remoteVideoRef.current && type === 'video' && peerStream) {
      remoteVideoRef.current.srcObject = peerStream;
    }
  }, [peerStream, type]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {type === 'video' && (
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              autoPlay
            />
          )}
          <div className="absolute bottom-2 left-2 text-white text-sm">
            You
          </div>
        </div>
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {peerStream && type === 'video' && (
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
            />
          )}
          <div className="absolute bottom-2 left-2 text-white text-sm">
            {isLearner ? 'Instructor' : 'Learner'}
          </div>
        </div>
      </div>
      {deviceError && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {deviceError}
        </div>
      )}
      <div className="flex justify-center gap-4">
        <Button
          variant={stream ? "destructive" : "default"}
          onClick={onToggleStream}
        >
          {stream ? 'Stop' : 'Start'} {type === 'video' ? 'Video' : 'Audio'}
        </Button>
      </div>
    </div>
  );
}
