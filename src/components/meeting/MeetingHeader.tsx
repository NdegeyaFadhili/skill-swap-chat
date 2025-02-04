
import { Button } from "@/components/ui/button";
import { MessageSquare, Video, PhoneCall, X } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";

interface MeetingHeaderProps {
  skillTitle: string;
  meetingType: string;
  onSwitchType: (type: string) => void;
  onEndMeeting: () => void;
}

export function MeetingHeader({ 
  skillTitle, 
  meetingType, 
  onSwitchType, 
  onEndMeeting 
}: MeetingHeaderProps) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-2xl mb-2">
            {skillTitle}
          </CardTitle>
          <div className="flex gap-4">
            <Button
              variant={meetingType === 'chat' ? "default" : "outline"}
              size="sm"
              onClick={() => onSwitchType('chat')}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button
              variant={meetingType === 'video' ? "default" : "outline"}
              size="sm"
              onClick={() => onSwitchType('video')}
            >
              <Video className="h-4 w-4 mr-2" />
              Video
            </Button>
            <Button
              variant={meetingType === 'audio' ? "default" : "outline"}
              size="sm"
              onClick={() => onSwitchType('audio')}
            >
              <PhoneCall className="h-4 w-4 mr-2" />
              Audio
            </Button>
          </div>
        </div>
        <Button variant="destructive" size="icon" onClick={onEndMeeting}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
}
