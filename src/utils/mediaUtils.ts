
export const startMediaStream = async (type: 'video' | 'audio') => {
  try {
    // First check if devices are available
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
    const hasAudioDevice = devices.some(device => device.kind === 'audioinput');

    // For video calls, we need both video and audio
    if (type === 'video') {
      if (!hasVideoDevice) {
        return { 
          stream: null, 
          error: 'No camera found. Please connect a camera and try again.' 
        };
      }
      if (!hasAudioDevice) {
        return { 
          stream: null, 
          error: 'No microphone found. Please connect a microphone and try again.' 
        };
      }
    } else {
      // For audio-only calls, we only need a microphone
      if (!hasAudioDevice) {
        return { 
          stream: null, 
          error: 'No microphone found. Please connect a microphone and try again.' 
        };
      }
    }

    // Request permissions and get stream
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
    });
    
    return { stream: mediaStream, error: null };
  } catch (error: any) {
    console.error('Media stream error:', error);
    let errorMessage = error.message;
    
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = `${type === 'video' ? 'Camera' : 'Microphone'} not found. Please check your device connections.`;
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = `Please allow access to your ${type === 'video' ? 'camera' : 'microphone'} to join the meeting.`;
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = `Could not start ${type === 'video' ? 'camera' : 'microphone'}. The device might be in use by another application.`;
    }
    
    return { stream: null, error: errorMessage };
  }
};

export const checkDevicePermissions = async (type: 'video' | 'audio') => {
  try {
    // Request permissions first, but only for the required devices
    await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true
    });

    // Then check available devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
    const hasAudioDevice = devices.some(device => device.kind === 'audioinput');

    // For video calls, we need both video and audio
    if (type === 'video') {
      if (!hasVideoDevice) {
        return { error: 'No camera found. Please connect a camera and try again.' };
      }
      if (!hasAudioDevice) {
        return { error: 'No microphone found. Please connect a microphone and try again.' };
      }
    } else {
      // For audio-only calls, we only need a microphone
      if (!hasAudioDevice) {
        return { error: 'No microphone found. Please connect a microphone and try again.' };
      }
    }

    return { error: null };
  } catch (error: any) {
    console.error('Device permission check error:', error);
    let errorMessage = error.message;

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = `${type === 'video' ? 'Camera' : 'Microphone'} not found. Please check your device connections.`;
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = `Please allow access to your ${type === 'video' ? 'camera' : 'microphone'} to join the meeting.`;
    }

    return { error: errorMessage };
  }
};
