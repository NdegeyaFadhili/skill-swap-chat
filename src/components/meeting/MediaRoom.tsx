
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

  // Set up local stream
  useEffect(() => {
    if (localVideoRef.current && stream) {
      console.log('Setting local stream');
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Set up remote stream
  useEffect(() => {
    if (remoteVideoRef.current && peerStream) {
      console.log('Setting remote stream');
      remoteVideoRef.current.srcObject = peerStream;
      
      // Ensure remote video starts playing
      remoteVideoRef.current.play().catch(err => {
        console.error('Error playing remote video:', err);
      });
    }
  }, [peerStream]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Local Video */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {type === 'video' && (
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover mirror"
              muted
              playsInline
              autoPlay
            />
          )}
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-sm rounded">
            You ({isLearner ? 'Learner' : 'Instructor'})
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {type === 'video' && (
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
            />
          )}
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-sm rounded">
            {isLearner ? 'Instructor' : 'Learner'}
          </div>
          {!peerStream && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              Waiting for {isLearner ? 'instructor' : 'learner'} to join...
            </div>
          )}
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
          className="min-w-[100px]"
        >
          {stream ? 'Stop' : 'Start'} {type === 'video' ? 'Video' : 'Audio'}
        </Button>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
