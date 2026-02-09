import { useEffect, useRef } from 'react';
import { useSdk } from '../contexts/SdkContext';
import { Alert } from 'react-native';

/**
 * Hook for setting up SDK event listeners
 * Handles all SDK events and updates context state
 */
export const useSdkEvents = (onActiveSpeakerChange) => {
  const {
    sdkInstance,
    addPeer,
    removePeer,
    updatePeerVideo,
    updatePeerAudio,
    removePeerVideo,
    removePeerAudio,
    updatePeerMuteStatus,
    addScreenShare,
    removeScreenShare,
    addAvailableTrack,
    removeAvailableTrack,
    peersRef,
  } = useSdk();

  const eventsSetupRef = useRef(false);

  useEffect(() => {
    if (!sdkInstance || eventsSetupRef.current) return;

    console.log('Setting up SDK event listeners');

    // Init success
    sdkInstance.on('initSuccess', () => {
      console.log('SDK initialized successfully');
    });

    // Processing events
    sdkInstance.on('processingStarted', ({ processingStartTime, requestId }) => {
      console.log('Processing started', { processingStartTime, requestId });
      Alert.alert(
        'Processing Started',
        `Processing started at: ${new Date(processingStartTime).toLocaleString()}`
      );
    });

    sdkInstance.on('processingCompleted', details => {
      console.log('Processing completed', details);
      Alert.alert('Processing Completed', 'Video processing has been completed');
    });

    sdkInstance.on('processingError', details => {
      console.error('Processing error:', details);
      Alert.alert('Processing Error', 'An error occurred during processing');
    });

    // Recording events
    sdkInstance.on('recordingStarted', ({ peerId, startTime }) => {
      console.log('Recording started', { peerId, startTime });
      Alert.alert(
        'Recording Started',
        `Recording started at: ${new Date(startTime).toLocaleString()}`
      );
    });

    sdkInstance.on('recordingEnded', () => {
      console.log('Recording ended');
      Alert.alert('Recording Ended', 'Recording has been stopped');
    });

    // Error events
    sdkInstance.on('error', ({ code, text }) => {
      console.error('SDK error:', { code, text });
      Alert.alert('Error', `${text} (Code: ${code})`);
    });

    // Peer events
    sdkInstance.on('newPeer', ({ peerId, peerName, type }) => {
      console.log('New peer joined', { peerId, peerName, type });
      addPeer(peerId, peerName, type);
    });

    sdkInstance.on('peerLeft', ({ peerId }) => {
      console.log('Peer left', { peerId });
      removePeer(peerId);
    });

    // Video events
    sdkInstance.on('videoStart', ({ peerId, videoTrack, type }) => {
      console.log('Video started', { peerId, type });
      updatePeerVideo(peerId, videoTrack, type);
    });

    sdkInstance.on('videoEnd', ({ peerId, type }) => {
      console.log('Video ended', { peerId, type });
      removePeerVideo(peerId, type);
    });

    // Audio events
    sdkInstance.on('micStart', ({ peerId, audioTrack, type }) => {
      console.log('Mic started', { peerId, type });
      updatePeerAudio(peerId, audioTrack, type);
    });

    sdkInstance.on('micEnd', ({ peerId }) => {
      console.log('Mic ended', { peerId });
      removePeerAudio(peerId);
    });

    sdkInstance.on('peerMuted', ({ peerId, type }) => {
      console.log('Peer muted', { peerId, type });
      updatePeerMuteStatus(peerId, true);
    });

    sdkInstance.on('peerUnMuted', ({ peerId, type }) => {
      console.log('Peer unmuted', { peerId, type });
      updatePeerMuteStatus(peerId, false);
    });

    // Screen share events
    sdkInstance.on('ssVideoStart', ({ peerId, videoTrack, type }) => {
      console.log('Screen share started', { peerId, type });
      addScreenShare(peerId, videoTrack, type);
    });

    sdkInstance.on('ssVideoStop', ({ peerId, videoTrack, type }) => {
      console.log('Screen share stopped', { peerId, type });
      removeScreenShare(peerId);
    });

    // Manual subscription: availableTracks event
    // This event fires when tracks become available for subscription
    sdkInstance.on('availableTracks', ({ peerId, mediaTags = [] }) => {
      console.log('Available tracks', { peerId, mediaTags });
      mediaTags.forEach(mediaTag => {
        addAvailableTrack(peerId, mediaTag, {
          available: true,
          timestamp: Date.now(),
        });
      });
    });

    // Subscription response events
    sdkInstance.on('subscribePeersResponse', response => {
      console.log('Subscribe peers response', response);
    });

    sdkInstance.on('unsubscribePeersResponse', response => {
      console.log('Unsubscribe peers response', response);
    });

    sdkInstance.on('stagePeersResponse', response => {
      console.log('Stage peers response', response);
    });

    // Device events
    sdkInstance.on('deviceListUpdated', () => {
      console.log('Device list updated');
    });

    // Live streaming events
    sdkInstance.on('liveStreamingStarted', () => {
      console.log('Live streaming started');
      Alert.alert('Live Streaming', 'Live streaming has started');
    });

    sdkInstance.on('liveStreamingEnded', () => {
      console.log('Live streaming ended');
      Alert.alert('Live Streaming', 'Live streaming has ended');
    });

    // Transcription events
    sdkInstance.on('transcription', ({ transcript, speaker, isFinal, timestamp }) => {
      console.log('Transcription', { transcript, speaker, isFinal, timestamp });
    });

    // Mic forced off
    sdkInstance.on('micForcedOff', ({ message }) => {
      console.log('Mic forced off', { message });
      Alert.alert('Microphone', message || 'Moderator muted you');
    });

    // Upgrade request events
    sdkInstance.on('upgradeRequestReceived', ({ peerId, moderator, message }) => {
      console.log('Upgrade request received', { peerId, moderator, message });
      Alert.alert(
        'Upgrade Request',
        message || 'Moderator wants to upgrade you to presenter',
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => sdkInstance.rejectUpgradeRequest?.(moderator),
          },
          {
            text: 'Accept',
            onPress: () => sdkInstance.acceptUpgradeRequest?.(true, false),
          },
        ]
      );
    });

    sdkInstance.on('upgradeRequestCancelled', ({ peerId }) => {
      console.log('Upgrade request cancelled', { peerId });
    });

    sdkInstance.on('upgradeRequestRejected', ({ message }) => {
      console.log('Upgrade request rejected', { message });
      Alert.alert('Upgrade Request', message || 'Request rejected');
    });

    sdkInstance.on('upgradeLimitReached', ({ message }) => {
      console.log('Upgrade limit reached', { message });
      Alert.alert('Upgrade Limit', message);
    });

    sdkInstance.on('screenShareLimitReached', ({ message }) => {
      console.log('Screen share limit reached', { message });
      Alert.alert('Screen Share Limit', message);
    });

    // Room lock events
    sdkInstance.on('roomLockStatusChanged', ({ locked, message }) => {
      console.log('Room lock status changed', { locked, message });
      if (message) {
        Alert.alert('Room Lock Status', message);
      }
    });

    // Waiting room events
    sdkInstance.on('peersWaiting', ({ peersWaiting, count }) => {
      console.log('Peers waiting', { peersWaiting, count });
    });

    // Participant role update events
    sdkInstance.on('participantUpgraded', ({ peerId, participantType }) => {
      console.log('Participant upgraded', { peerId, participantType });
    });

    sdkInstance.on('participantDowngraded', ({ peerId, participantType }) => {
      console.log('Participant downgraded', { peerId, participantType });
    });

    sdkInstance.on('upgraded', () => {
      console.log('You have been upgraded');
      Alert.alert('Upgrade', 'You are now a presenter');
    });

    sdkInstance.on('downgraded', () => {
      console.log('You have been downgraded');
      Alert.alert('Downgrade', 'You are now a viewer');
    });

    // Active speaker event
    sdkInstance.on('activeSpeaker', ({ peerId, volume }) => {
      console.log('Active speaker changed', { peerId, volume });
      if (onActiveSpeakerChange && peerId) {
        onActiveSpeakerChange(peerId);
      }
    });

    eventsSetupRef.current = true;

    return () => {
      // Cleanup: Remove all listeners when component unmounts
      if (sdkInstance) {
        sdkInstance.removeAllListeners();
        eventsSetupRef.current = false;
      }
    };
  }, [
    sdkInstance,
    addPeer,
    removePeer,
    updatePeerVideo,
    updatePeerAudio,
    removePeerVideo,
    removePeerAudio,
    updatePeerMuteStatus,
    addScreenShare,
    removeScreenShare,
    addAvailableTrack,
    removeAvailableTrack,
    onActiveSpeakerChange,
  ]);
};
