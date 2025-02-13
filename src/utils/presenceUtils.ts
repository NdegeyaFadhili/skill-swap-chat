
import { supabase } from "@/integrations/supabase/client";
import { RealtimePresenceState } from '@supabase/supabase-js';

export type UserPresence = {
  user_id: string;
  online_at: string;
  is_instructor: boolean;
  status?: 'joined' | 'ready';
};

export type PresenceState = {
  [key: string]: UserPresence[];
};

const transformPresenceState = (state: RealtimePresenceState<UserPresence>): PresenceState => {
  const transformedState: PresenceState = {};
  
  for (const [key, presences] of Object.entries(state)) {
    transformedState[key] = presences.map(presence => ({
      user_id: presence.user_id,
      online_at: presence.online_at,
      is_instructor: presence.is_instructor,
      status: presence.status
    }));
  }
  
  return transformedState;
};

export const setupPresenceChannel = (
  meetingId: string,
  userId: string,
  learnerId: string,
  instructorId: string,
  onPresenceChange?: (state: PresenceState) => void
) => {
  console.log('Setting up presence channel for meeting:', meetingId);
  console.log('Participants:', { userId, learnerId, instructorId });

  const presenceChannel = supabase.channel(`presence:${meetingId}`, {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const rawState = presenceChannel.presenceState<UserPresence>();
      const state = transformPresenceState(rawState);
      console.log('Presence state synced:', state);
      if (onPresenceChange) {
        onPresenceChange(state);
      }
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key, leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const presence: UserPresence = {
          user_id: userId,
          online_at: new Date().toISOString(),
          is_instructor: userId === instructorId,
          status: 'joined'
        };
        console.log('Tracking presence:', presence);
        await presenceChannel.track(presence);
      }
    });

  return presenceChannel;
};
