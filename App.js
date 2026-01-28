import React, {useState, useEffect, useRef} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Button,
  Text,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import axios from 'axios';
import samvyo from './lib/rnsdk.cjs.js';
import {RTCView} from 'react-native-webrtc';

const App = () => {
  const [callStatus, setCallStatus] = useState('');
  const [roomId, setRoomId] = useState('');
  const [peerName, setPeerName] = useState('peer-1');
  const sdkInstanceRef = useRef(null);
  let sdkInstance = null;

  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  const [peers, setPeers] = useState(new Map());
  const [screenShares, setScreenShares] = useState(new Map());
  const peersRef = useRef(peers);
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);

  const [isRoomInitialized, setIsRoomInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [roomType, setRoomType] = useState('conferencing');
  const [participantRole, setParticipantRole] = useState('moderator');
  const [handRaised, setHandRaised] = useState(false);
  const [handRaiseEvents, setHandRaiseEvents] = useState([]);
  const [recentReactions, setRecentReactions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedChatReceiver, setSelectedChatReceiver] = useState('everyone');
  const [chatTargetModalVisible, setChatTargetModalVisible] = useState(false);
  const [transcriptionEntries, setTranscriptionEntries] = useState([]);
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [liveStreamUrl, setLiveStreamUrl] = useState('');
  const [liveStreamKey, setLiveStreamKey] = useState('');
  const [stageSettings, setStageSettings] = useState({
    stageStatus: false,
    stagePeers: [],
    backStageStatus: false,
    backStagePeers: [],
  });
  const [stagePeersInput, setStagePeersInput] = useState('');
  const [backStagePeersInput, setBackStagePeersInput] = useState('');
  const [generalPermissions, setGeneralPermissions] = useState({
    allowScreenShare: true,
    noOfScreenShare: 1,
    noOfUpgradeRequests: 5,
  });
  const [presenterPermissions, setPresenterPermissions] = useState({
    allowPresenterRaiseHand: true,
    allowPresenterPublicChat: true,
    allowPresenterPrivateChat: true,
  });
  const [participantPermissionsState, setParticipantPermissionsState] =
    useState({
      allowParticipantRaiseHand: true,
      allowParticipantPublicChat: true,
      allowParticipantPrivateChat: true,
    });
  const [roomLocked, setRoomLocked] = useState(false);
  const [waitingPeers, setWaitingPeers] = useState([]);
  const [pendingUpgradeRequests, setPendingUpgradeRequests] = useState([]);

  const inputParams = {
    videoResolution: 'hd',
    produce: true,
    produceAudio: true,
    produceVideo: true,
    forcePCMU: false,
    forceH264: false,
    h264Profile: 'high',
    forceFPS: 30,
    enableWebcamLayers: true,
    numSimulcastStreams: 3,
    videoBitRates: [500, 250, 100],
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44000,
    channelCount: 1,
    msRegion: 'us',
    backgroundImage: '',
  };

  const resolvedPeerType =
    roomType === 'event'
      ? participantRole === 'moderator'
        ? 'moderator'
        : participantRole === 'presenter'
        ? 'participant'
        : 'attendee'
      : participantRole === 'moderator'
      ? 'moderator'
      : 'participant';

  const canProduceMedia = resolvedPeerType !== 'attendee';
  const isModeratorRole = resolvedPeerType === 'moderator';
  const isModeratorRoleRef = useRef(isModeratorRole);
  useEffect(() => {
    isModeratorRoleRef.current = isModeratorRole;
  }, [isModeratorRole]);
  const emojiList = ['👍', '❤️', '🎉', '👏', '🔥', '😂', '😮', '🙌', '✨'];

  useEffect(() => {
    console.log('App initialized, fetching devices');
    getAllDevices();
  }, []);

  useEffect(() => {
    if (roomType === 'event') {
      if (!['moderator', 'presenter', 'attendee'].includes(participantRole)) {
        setParticipantRole('attendee');
      }
      return;
    }

    if (!['moderator', 'participant'].includes(participantRole)) {
      setParticipantRole('participant');
    }
  }, [roomType, participantRole]);

  const getAllDevices = async () => {
    try {
      console.log('Getting all devices');
      const availableDevices = await samvyo.RNSdk.listDevices();

      if (availableDevices.success) {
        console.log('Device fetch successful', {
          audioCount: availableDevices.deviceList.audioDevices.length,
          videoCount: availableDevices.deviceList.videoDevices.length,
        });

        setAudioDevices(availableDevices.deviceList.audioDevices);
        setVideoDevices(availableDevices.deviceList.videoDevices);

        // Set default devices
        if (availableDevices.deviceList.audioDevices.length > 0) {
          const defaultAudioDevice =
            availableDevices.deviceList.audioDevices[0].deviceId;
          console.log('Setting default audio device', {
            deviceId: defaultAudioDevice,
          });
          setSelectedAudioDeviceId(defaultAudioDevice);
        }

        if (availableDevices.deviceList.videoDevices.length > 0) {
          const defaultVideoDevice =
            availableDevices.deviceList.videoDevices[0].deviceId;
          console.log('Setting default video device', {
            deviceId: defaultVideoDevice,
          });
          setSelectedVideoDeviceId(defaultVideoDevice);
        }
      } else {
        console.log('Device fetch returned unsuccessful', availableDevices);
      }
    } catch (error) {
      console.log('Error getting devices', error);
    }
  };

  const fetchSessionToken = async () => {
    try {
      console.log('Fetching session token', {roomId});
      const data = {roomId};
      const apiUrl =
        Platform.OS === 'android'
          ? 'http://10.0.2.2:5100/api/create-session-token'
          : 'http://192.168.0.128:5100/api/create-session-token';

      console.log('Using API URL', {apiUrl});

      const response = await axios.post(apiUrl, data);
      console.log('Session token response', {
        status: response.status,
        success: response.data.success,
      });

      if (response.data.success) {
        console.log('Session token fetched successfully');
        return response.data.sessionToken;
      } else {
        console.log('Failed to fetch session token', {
          data: response.data,
        });
        Alert.alert('Error', 'Failed to fetch session token');
        return null;
      }
    } catch (error) {
      console.log('Error fetching session token', error);
      Alert.alert('Error', 'Internal Server Error');
      return null;
    }
  };

  const initRoom = async () => {
    console.log('Init room');
    console.log('Fetching session token');

    if (!roomId.trim()) {
      console.log('Room ID is empty');
      Alert.alert('Error', 'Room ID cannot be empty');
      return;
    }

    const sessionToken = await fetchSessionToken();
    if (!sessionToken) {
      console.log('Session token not found');
      return;
    }
    const initialParams = {
      sessionToken,
      roomId,
      peerName,
    };
    try {
      sdkInstance = await samvyo.RNSdk.init(initialParams);
      sdkInstanceRef.current = sdkInstance;
      console.log('SDK initialized successfully', {
        sdkInstance,
      });

      sdkInstance.on('initSuccess', () => {
        console.log('SDK initialized successfully');
        setIsRoomInitialized(true);
      });

      // Set up all event listeners
      sdkInstance.on('processingStarted', ({ processingStartTime, requestId }) => {
        console.log(`Processing has been started`, { processingStartTime, requestId });
        Alert.alert('Processing Started', `Processing has been started at: ${new Date(processingStartTime).toLocaleString()}`);
      });

      sdkInstance.on('processingCompleted', (details) => {
        console.log(`Processing has been completed`, details);
        Alert.alert('processing completed');
        setIsProcessing(false);
      });

      sdkInstance.on('processingError', (details) => {
        console.error('Processing error:', details);
        setIsProcessing(false);
        Alert.alert('Processing Error', 'An error occurred during processing');
      });

      sdkInstance.on('recordingStarted', ({ peerId, startTime }) => {
        console.log(`Recording has been started in this room at ${startTime}`);
        Alert.alert('Recording Started', `Recording has been started on the room at: ${new Date(startTime).toLocaleString()}`);
        setIsRecording(true);
      });

      sdkInstance.on('recordingEnded', () => {
        console.log(`Recording has been ended on this room`);
        Alert.alert('Recording Ended', `Recording has been ended on the room`);
        setIsRecording(false);
      });

      sdkInstance.on('error', ({code, text}) => {
        console.log(`SDK error: ${text} (Code: ${code})`);
        Alert.alert('Error', `${text} (Code: ${code})`);
      });
    } catch (error) {
      console.error('Error initialising room:', error);
    }
  };

  const startCall = async () => {
    console.log('Starting call', {roomId, peerName});

    if (!roomId.trim()) {
      console.log('Room ID is empty');
      Alert.alert('Error', 'Room ID cannot be empty');
      return;
    }

    try {
      const roomParams = {
        ...inputParams,
        peerName,
        roomType,
        peerType: resolvedPeerType,
        produce: canProduceMedia,
        consume: true,
        produceAudio: canProduceMedia && !isMuted,
        produceVideo: canProduceMedia && !isCameraOff,
        audioDeviceId: selectedAudioDeviceId,
        videoDeviceId: selectedVideoDeviceId,
      };

      console.log('Room params', roomParams);
      setCallStatus('Joining room...');

      console.log('Joining room with SDK');
      console.log('SDK instance', sdkInstanceRef.current);
      await sdkInstanceRef.current.joinRoom(roomParams);

      console.log('Room joined successfully');
      setCallStatus('Call started successfully!');
      setHandRaised(false);
      setHandRaiseEvents([]);
      setRecentReactions([]);
      setChatMessages([]);
      setTranscriptionEntries([]);
      setPendingUpgradeRequests([]);
      setWaitingPeers([]);
      setRoomLocked(false);

      // Set up event listeners
      console.log('Setting up event listeners');

      sdkInstanceRef.current.on('newPeer', ({peerId, peerName, type}) => {
        console.log('New peer joined', {peerId, peerName, type});
        addPeer(peerId, peerName, type);
      });

      sdkInstanceRef.current.on('videoStart', ({peerId, videoTrack, type}) => {
        console.log('Video started for peer', {
          peerId,
          type,
          hasVideoTrack: !!videoTrack,
          videoTrackType: videoTrack ? typeof videoTrack : 'none',
          videoTrackMethods: videoTrack
            ? Object.getOwnPropertyNames(Object.getPrototypeOf(videoTrack))
            : [],
        });
        updatePeerVideo(peerId, videoTrack, type);
      });

      sdkInstanceRef.current.on('videoEnd', ({peerId, type}) => {
        console.log('Video ended for peer', {peerId, type});
        removePeerVideo(peerId, type);
      });

      sdkInstanceRef.current.on('deviceListUpdated', () => {
        console.log('Device list updated');
        getAllDevices();
      });

      sdkInstanceRef.current.on('processingCompleted', details => {
        console.log(`Processing has been completed`, details);
        setIsProcessing(false);
      });

      sdkInstanceRef.current.on('recordingStarted', ({peerId, startTime}) => {
        console.log(`Recording has been started in this room at ${startTime}`);
        alert(`Recording has been started on the room at: ${startTime}`);
        setIsRecording(true);
      });

      sdkInstanceRef.current.on('recordingEnded', () => {
        console.log(`Recording has been ended on this room at`);
        alert(`Recording has been ended on the room at`);
        setIsRecording(false);
      });

      sdkInstanceRef.current.on('micStart', ({peerId, audioTrack, type}) => {
        console.log('Mic started for peer', {
          peerId,
          hasAudioTrack: !!audioTrack,
          type,
        });
        updatePeerAudio(peerId, audioTrack, type);
      });

      sdkInstanceRef.current.on('micEnd', ({peerId}) => {
        console.log('Mic ended for peer', {peerId});
        removePeerAudio(peerId);
      });

      sdkInstanceRef.current.on('peerMuted', ({peerId, type}) => {
        console.log('Peer muted', {peerId, type});
        updatePeerMuteStatus(peerId, true);
      });

      sdkInstanceRef.current.on('peerUnMuted', ({peerId, type}) => {
        console.log('Peer unmuted', {peerId, type});
        updatePeerMuteStatus(peerId, false);
      });

      sdkInstanceRef.current.on('peerLeft', ({peerId}) => {
        console.log('Peer left', {peerId});
        removePeer(peerId);
      });

      sdkInstanceRef.current.on(
        'ssVideoStart',
        ({peerId, videoTrack, type}) => {
          console.log('Screen share started', {
            peerId,
            hasVideoTrack: !!videoTrack,
            videoTrackType: videoTrack ? typeof videoTrack : 'none',
            type,
          });
          addScreenShare(peerId, videoTrack, type);
        },
      );

      sdkInstanceRef.current.on('ssVideoStop', ({peerId, videoTrack, type}) => {
        console.log('Screen share stopped', {peerId, type});
        removeScreenShare(peerId);
      });

      sdkInstanceRef.current.on('customMessage', handleCustomMessageEvent);
      sdkInstanceRef.current.on('handRaise', handleHandRaiseEvent);
      sdkInstanceRef.current.on('liveStreamingStarted', () => {
        setIsLiveStreaming(true);
        Alert.alert('Live Streaming', 'Live streaming has started');
      });
      sdkInstanceRef.current.on('liveStreamingEnded', () => {
        setIsLiveStreaming(false);
        Alert.alert('Live Streaming', 'Live streaming has ended');
      });
      sdkInstanceRef.current.on('transcription', handleTranscriptionEvent);
      sdkInstanceRef.current.on('micForcedOff', ({message}) => {
        setIsMuted(true);
        Alert.alert('Microphone', message || 'Moderator muted you');
      });
      sdkInstanceRef.current.on('upgradeRequestReceived', handleUpgradeRequestReceived);
      sdkInstanceRef.current.on('upgradeRequestCancelled', handleUpgradeRequestCancelled);
      sdkInstanceRef.current.on('upgradeRequestRejected', ({message}) => {
        Alert.alert('Upgrade Request', message || 'Request rejected');
      });
      sdkInstanceRef.current.on('upgradeLimitReached', ({message}) => {
        Alert.alert('Upgrade Limit', message);
      });
      sdkInstanceRef.current.on(
        'screenShareLimitReached',
        ({message}) => Alert.alert('Screen Share Limit', message),
      );
      sdkInstanceRef.current.on('roomLockStatusChanged', ({locked, message}) => {
        setRoomLocked(!!locked);
        if (message) {
          Alert.alert('Room Lock Status', message);
        }
      });
      sdkInstanceRef.current.on('peersWaiting', ({peersWaiting, count}) => {
        setWaitingPeers(peersWaiting || []);
        if (isModeratorRole && count) {
          Alert.alert('Waiting Room', `${count} participant(s) waiting for approval`);
        }
      });
      sdkInstanceRef.current.on('participantUpgraded', handleParticipantRoleUpdate);
      sdkInstanceRef.current.on('participantDowngraded', handleParticipantRoleUpdate);
      sdkInstanceRef.current.on('upgraded', () => {
        setCallStatus('You are now a presenter');
      });
      sdkInstanceRef.current.on('downgraded', () => {
        setCallStatus('You are now a viewer');
      });
    } catch (err) {
      console.log('Join room error', err);
      setCallStatus('Failed to join room.');
      Alert.alert('Error', err.message || 'Failed to join');
    }
  };

  const leaveRoom = async () => {
    try {
      console.log('Attempting to leave room');
      if (sdkInstanceRef.current) {
        const response = await sdkInstanceRef.current.leaveRoom();
        console.log('Left room successfully', response);
        setCallStatus('Left room successfully!');
        Alert.alert('Success', 'Successfully left the room!');

        setPeers(new Map());
        setScreenShares(new Map());
        setHandRaised(false);
        setHandRaiseEvents([]);
        setRecentReactions([]);
        setChatMessages([]);
        setTranscriptionEntries([]);
        setPendingUpgradeRequests([]);
        setWaitingPeers([]);
        setIsLiveStreaming(false);
        setRoomLocked(false);
        setStageSettings({
          stageStatus: false,
          stagePeers: [],
          backStageStatus: false,
          backStagePeers: [],
        });
        setStagePeersInput('');
        setBackStagePeersInput('');
        sdkInstanceRef.current = null;

        showThankYouMessage();
        setIsRoomInitialized(false);
      } else {
        console.log('No active SDK instance to leave room');
      }
    } catch (err) {
      console.log('Leave room error', err);
      setCallStatus('Failed to leave room.');
      Alert.alert('Error', err.message || 'Failed to leave');
    }
  };

  const addPeer = (peerId, peerName, type) => {
    console.log('Adding peer', {peerId, peerName, type});
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      newPeers.set(peerId, {
        peerId,
        peerName,
        type,
        videoTrack: null,
        audioTrack: null,
        isMuted: false,
        isCameraOff: false,
      });
      console.log('Updated peers map', {
        peerCount: newPeers.size,
        peerIds: Array.from(newPeers.keys()),
      });
      return newPeers;
    });
  };

  const updatePeerVideo = (peerId, videoTrack, type) => {
    console.log('Updating peer video', {
      peerId,
      hasVideoTrack: !!videoTrack,
      type,
    });

    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);

      if (peer) {
        console.log('Found peer to update video', {peerId});

        // Create a new MediaStream and add the track
        let stream = null;
        if (videoTrack) {
          try {
            stream = new MediaStream();
            stream.addTrack(videoTrack);
            console.log('Created MediaStream for peer video', {
              streamId: stream.id,
              active: stream.active,
              tracks: stream.getTracks().map(t => t.id),
            });
          } catch (error) {
            console.error('Error creating MediaStream:', error);
          }
        }

        peer.videoTrack = stream; // Store the stream instead of raw track
        peer.isCameraOff = false;
      } else {
        console.log('Peer not found for video update', {peerId});
      }

      return newPeers;
    });
  };

  const removePeerVideo = (peerId, type) => {
    console.log('Removing peer video', {peerId, type});
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        console.log('Found peer to remove video', {peerId});
        peer.videoTrack = null;
        peer.isCameraOff = true;
      } else {
        console.log('Peer not found for video removal', {peerId});
      }
      return newPeers;
    });
  };

  const updatePeerAudio = (peerId, audioTrack, type) => {
    console.log('Updating peer audio', {
      peerId,
      hasAudioTrack: !!audioTrack,
      type,
    });
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        console.log('Found peer to update audio', {peerId});
        peer.audioTrack = audioTrack;
        peer.isMuted = false;
      } else {
        console.log('Peer not found for audio update', {peerId});
      }
      return newPeers;
    });
  };

  const removePeerAudio = peerId => {
    console.log('Removing peer audio', {peerId});
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        console.log('Found peer to remove audio', {peerId});
        peer.audioTrack = null;
      } else {
        console.log('Peer not found for audio removal', {peerId});
      }
      return newPeers;
    });
  };

  const updatePeerMuteStatus = (peerId, isMuted) => {
    console.log('Updating peer mute status', {peerId, isMuted});
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        console.log('Found peer to update mute status', {peerId});
        peer.isMuted = isMuted;
      } else {
        console.log('Peer not found for mute status update', {peerId});
      }
      return newPeers;
    });
  };

  const removePeer = peerId => {
    console.log('Removing peer', {peerId});
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      if (newPeers.has(peerId)) {
        newPeers.delete(peerId);
        console.log('Peer removed successfully', {
          remainingPeers: newPeers.size,
        });
      } else {
        console.log('Peer not found for removal', {peerId});
      }
      return newPeers;
    });
  };

  const handleParticipantRoleUpdate = ({peerId, participantType}) => {
    setPeers(prevPeers => {
      const updated = new Map(prevPeers);
      const peer = updated.get(peerId);
      if (peer) {
        updated.set(peerId, {...peer, participantType});
      }
      return updated;
    });
  };

  const handleCustomMessageEvent = message => {
    if (!message) {
      return;
    }

    if (message.type === 'chat') {
      const displayName =
        message.from === 'me'
          ? 'You'
          : peersRef.current.get(message.from)?.peerName || message.from;
      setChatMessages(prev => {
        const next = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            from: displayName,
            text: message.data,
            scope: message.messageType === 'private' ? 'private' : 'public',
            timestamp: new Date().toLocaleTimeString(),
          },
        ];
        return next.slice(-200);
      });
      return;
    }

    let payload = message.customData || message.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      return;
    }

    if (payload.type === 'emoji-reaction') {
      const displayName =
        message.from === 'me'
          ? 'You'
          : peersRef.current.get(message.from)?.peerName || message.from;
      setRecentReactions(prev => {
        const next = [
          ...prev.slice(-5),
          {
            id: `${Date.now()}-${Math.random()}`,
            emoji: payload.emoji,
            from: displayName,
          },
        ];
        return next;
      });
      return;
    }

    if (payload.type === 'roomSetting:stageSettings') {
      setStageSettings({
        stageStatus: !!payload.stageStatus,
        stagePeers: payload.stagePeers || [],
        backStageStatus: !!payload.backStageStatus,
        backStagePeers: payload.backStagePeers || [],
      });
      setStagePeersInput((payload.stagePeers || []).join(','));
      setBackStagePeersInput((payload.backStagePeers || []).join(','));
      return;
    }

    if (payload.type === 'roomSetting:generalSettings') {
      setGeneralPermissions(prev => ({
        ...prev,
        allowScreenShare:
          payload.allowScreenShare !== undefined
            ? payload.allowScreenShare
            : prev.allowScreenShare,
        noOfScreenShare:
          payload.noOfScreenShare !== undefined
            ? payload.noOfScreenShare
            : prev.noOfScreenShare,
        noOfUpgradeRequests:
          payload.noOfUpgradeRequests !== undefined
            ? payload.noOfUpgradeRequests
            : prev.noOfUpgradeRequests,
      }));
      return;
    }

    if (payload.type === 'roomSetting:presenterSettings') {
      setPresenterPermissions(prev => ({
        ...prev,
        ...(payload.presenterSettings || {}),
      }));
      return;
    }

    if (payload.type === 'roomSetting:participantSettings') {
      setParticipantPermissionsState(prev => ({
        ...prev,
        ...(payload.participantSettings || {}),
      }));
    }
  };

  const handleHandRaiseEvent = ({
    peerId,
    handRaised: isRaised,
    peerName,
    upgradeRequest,
  }) => {
    const displayName =
      peerName || peersRef.current.get(peerId)?.peerName || peerId;

    setHandRaiseEvents(prev => {
      const filtered = prev.filter(item => item.peerId !== peerId);
      if (!isRaised) {
        return filtered;
      }
      return [
        {
          peerId,
          peerName: displayName,
          upgradeRequest: !!upgradeRequest,
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, 25);
    });

    if (peerId === sdkInstanceRef.current?.data?.inputParams?.peerId) {
      setHandRaised(!!isRaised);
    }
  };

  const handleTranscriptionEvent = ({
    transcript,
    speaker,
    isFinal,
    timestamp,
  }) => {
    if (!transcript) {
      return;
    }
    setTranscriptionEntries(prev => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          transcript,
          speaker: speaker || 'unknown',
          isFinal: !!isFinal,
          timestamp: timestamp || Date.now(),
        },
      ];
      return next.slice(-50);
    });
  };

  const handleUpgradeRequestReceived = ({peerId, moderator, message}) => {
    if (!isModeratorRoleRef.current) {
      Alert.alert(
        'Moderator Invite',
        message || 'Moderator wants to upgrade you to presenter',
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () =>
              sdkInstanceRef.current?.rejectUpgradeRequest?.(moderator),
          },
          {
            text: 'Accept',
            onPress: () =>
              sdkInstanceRef.current?.acceptUpgradeRequest?.(true, false),
          },
        ],
      );
      return;
    }
    const displayName =
      peersRef.current.get(peerId)?.peerName || peerId || 'Unknown participant';
    setPendingUpgradeRequests(prev => {
      const filtered = prev.filter(req => req.peerId !== peerId);
      return [
        {
          peerId,
          moderator,
          message: message || `${displayName} requested presenter access`,
          timestamp: Date.now(),
        },
        ...filtered,
      ];
    });
    Alert.alert(
      'Upgrade Request',
      `${displayName} would like to become a presenter.`,
    );
  };

  const handleUpgradeRequestCancelled = ({peerId}) => {
    setPendingUpgradeRequests(prev =>
      prev.filter(request => request.peerId !== peerId),
    );
  };

  const toggleHandRaise = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      if (handRaised) {
        await sdkInstanceRef.current.dropHand();
        setHandRaised(false);
      } else {
        await sdkInstanceRef.current.raiseHand();
        setHandRaised(true);
      }
    } catch (error) {
      Alert.alert('Hand Raise', error?.message || 'Unable to update hand status');
    }
  };

  const requestPresenterUpgrade = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      const response = await sdkInstanceRef.current.requestUpgradeToPresenter();
      if (!response?.success) {
        Alert.alert('Upgrade Request', response?.reason || 'Upgrade request failed');
      } else {
        Alert.alert('Upgrade Request', 'Request sent to moderators');
      }
    } catch (error) {
      Alert.alert('Upgrade Request', error?.message || 'Unable to request upgrade');
    }
  };

  const sendReaction = async emoji => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.sendCustomMessage(
        JSON.stringify({
          type: 'emoji-reaction',
          emoji,
          emojiType: emoji,
        }),
        'custom',
      );
      setRecentReactions(prev => [
        ...prev.slice(-5),
        {id: `${Date.now()}-${Math.random()}`, emoji, from: 'You'},
      ]);
    } catch (error) {
      Alert.alert('Emoji', error?.message || 'Unable to send reaction');
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !sdkInstanceRef.current) {
      return;
    }
    try {
      const receiverPeerId =
        selectedChatReceiver === 'everyone' ? null : selectedChatReceiver;
      const scope = receiverPeerId ? 'private' : 'public';
      await sdkInstanceRef.current.sendCustomMessage(
        chatInput.trim(),
        'chat',
        receiverPeerId,
        resolvedPeerType,
        scope,
      );
      setChatMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          from: 'You',
          text: chatInput.trim(),
          scope,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setChatInput('');
    } catch (error) {
      Alert.alert('Chat', error?.message || 'Unable to send message');
    }
  };

  const applyGeneralPermissions = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.handleRoomSettingsGeneral(generalPermissions);
      Alert.alert('Permissions', 'General settings updated');
    } catch (error) {
      Alert.alert('Permissions', error?.message || 'Unable to update general settings');
    }
  };

  const applyPresenterPermissions = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.handlePresenterSettings(presenterPermissions);
      Alert.alert('Permissions', 'Presenter settings updated');
    } catch (error) {
      Alert.alert(
        'Permissions',
        error?.message || 'Unable to update presenter settings',
      );
    }
  };

  const applyParticipantPermissions = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.handleParticipantSettings(
        participantPermissionsState,
      );
      Alert.alert('Permissions', 'Participant settings updated');
    } catch (error) {
      Alert.alert(
        'Permissions',
        error?.message || 'Unable to update participant settings',
      );
    }
  };

  const applyStageSettingsChanges = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    const stagePeers = stagePeersInput
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    const backStagePeers = backStagePeersInput
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    try {
      await sdkInstanceRef.current.handleRoomSettingsStage({
        stageStatus: stageSettings.stageStatus,
        stagePeers,
        backStageStatus: stageSettings.backStageStatus,
        backStagePeers,
      });
      Alert.alert('Stage', 'Stage settings updated');
    } catch (error) {
      Alert.alert('Stage', error?.message || 'Unable to update stage settings');
    }
  };

  const toggleSelfStagePosition = async target => {
    if (!sdkInstanceRef.current) {
      return;
    }
    const myPeerId = sdkInstanceRef.current?.data?.inputParams?.peerId;
    if (!myPeerId) {
      return;
    }
    const currentStagePeers = new Set(stageSettings.stagePeers || []);
    const currentBackPeers = new Set(stageSettings.backStagePeers || []);
    currentStagePeers.delete(myPeerId);
    currentBackPeers.delete(myPeerId);

    if (target === 'stage') {
      currentStagePeers.add(myPeerId);
    } else if (target === 'backstage') {
      currentBackPeers.add(myPeerId);
    }

    try {
      await sdkInstanceRef.current.handleRoomSettingsStage({
        stageStatus: true,
        stagePeers: Array.from(currentStagePeers),
        backStageStatus: true,
        backStagePeers: Array.from(currentBackPeers),
      });
    } catch (error) {
      Alert.alert('Stage', error?.message || 'Unable to update stage position');
    }
  };

  const startLiveStreamingSession = async () => {
    if (!sdkInstanceRef.current || !liveStreamUrl.trim() || !liveStreamKey.trim()) {
      Alert.alert('Live Streaming', 'Please enter stream URL and key');
      return;
    }
    try {
      const response = await sdkInstanceRef.current.startLiveStreaming({
        streamUrl: liveStreamUrl.trim(),
        streamKey: liveStreamKey.trim(),
      });
      if (response?.success === false) {
        throw new Error(response?.text || response?.reason);
      }
      setIsLiveStreaming(true);
    } catch (error) {
      Alert.alert('Live Streaming', error?.message || 'Unable to start streaming');
    }
  };

  const stopLiveStreamingSession = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.stopLiveStreaming();
      setIsLiveStreaming(false);
    } catch (error) {
      Alert.alert('Live Streaming', error?.message || 'Unable to stop streaming');
    }
  };

  const startTranscriptionSession = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      const response = await sdkInstanceRef.current.startTranscription();
      if (response?.success === false) {
        throw new Error(response?.reason);
      }
      setTranscriptionActive(true);
    } catch (error) {
      Alert.alert(
        'Transcription',
        error?.message || 'Unable to start transcription',
      );
    }
  };

  const stopTranscriptionSession = async () => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.stopTranscription();
      setTranscriptionActive(false);
    } catch (error) {
      Alert.alert(
        'Transcription',
        error?.message || 'Unable to stop transcription',
      );
    }
  };

  const handleUpgradeParticipantPress = peerId => {
    if (!sdkInstanceRef.current) {
      return;
    }
    sdkInstanceRef.current
      .upgradeParticipant(peerId)
      .then(() => {
        setPendingUpgradeRequests(prev =>
          prev.filter(request => request.peerId !== peerId),
        );
        Alert.alert('Upgrade', 'Participant upgrade sent');
      })
      .catch(error =>
        Alert.alert('Upgrade', error?.message || 'Unable to upgrade participant'),
      );
  };

  const handleDowngradeParticipantPress = peerId => {
    if (!sdkInstanceRef.current) {
      return;
    }
    sdkInstanceRef.current
      .downgradeParticipant(peerId)
      .then(() => Alert.alert('Downgrade', 'Participant downgrade sent'))
      .catch(error =>
        Alert.alert('Downgrade', error?.message || 'Unable to downgrade participant'),
      );
  };

  const handleModeratorSendUpgradeRequest = (peerId, status = true) => {
    if (!sdkInstanceRef.current) {
      return;
    }
    sdkInstanceRef.current
      .sendUpgradeRequest(peerId, status)
      .then(() => {
        Alert.alert(
          'Moderator Action',
          status ? 'Upgrade request sent' : 'Upgrade request cancelled',
        );
      })
      .catch(error =>
        Alert.alert(
          'Moderator Action',
          error?.message || 'Unable to send moderator upgrade request',
        ),
      );
  };

  const lowerParticipantHand = async peerId => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.dropHand(peerId, true);
      setHandRaiseEvents(prev =>
        prev.filter(request => request.peerId !== peerId),
      );
    } catch (error) {
      Alert.alert('Hand Raise', error?.message || 'Unable to lower hand');
    }
  };

  const admitWaitingPeer = async peerId => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.allowRoomJoin(peerId);
      setWaitingPeers(prev => prev.filter(peer => peer.peerId !== peerId));
    } catch (error) {
      Alert.alert('Waiting Room', error?.message || 'Unable to admit participant');
    }
  };

  const denyWaitingPeer = async peerId => {
    if (!sdkInstanceRef.current) {
      return;
    }
    try {
      await sdkInstanceRef.current.denyRoomJoin(peerId);
      setWaitingPeers(prev => prev.filter(peer => peer.peerId !== peerId));
    } catch (error) {
      Alert.alert('Waiting Room', error?.message || 'Unable to deny participant');
    }
  };

  // Screen share functions
  const addScreenShare = (peerId, videoTrack, type) => {
    console.log('Adding screen share', {
      peerId,
      hasVideoTrack: !!videoTrack,
      type,
    });

    setScreenShares(prevShares => {
      const newShares = new Map(prevShares);
      let stream = null;

      if (videoTrack) {
        try {
          stream = new MediaStream();
          stream.addTrack(videoTrack);
          console.log('Created MediaStream for screen share', {
            streamId: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(t => t.id),
          });
        } catch (error) {
          console.error('Error creating MediaStream:', error);
        }
      } else {
        console.warn(`No videoTrack provided for peer ${peerId}`);
        return newShares;
      }

      if (newShares.has(peerId)) {
        console.log('Screen share already exists, updating', {peerId});
        const share = newShares.get(peerId);
        share.videoTrack = stream;
      } else {
        console.log('Adding new screen share for peer', {peerId});
        newShares.set(peerId, {
          peerId,
          videoTrack: stream,
          type,
        });
      }

      return newShares;
    });
  };

  const removeScreenShare = peerId => {
    console.log('Removing screen share', {peerId});
    setScreenShares(prevShares => {
      const newShares = new Map(prevShares);
      if (newShares.has(peerId)) {
        newShares.delete(peerId);
        console.log('Screen share removed successfully', {
          remainingShares: newShares.size,
        });
      } else {
        console.log('Screen share not found for removal', {peerId});
      }
      return newShares;
    });
  };

  const toggleMute = async () => {
    try {
      console.log('Toggling mute', {currentState: isMuted});
      if (isMuted) {
        await sdkInstanceRef.current.unmuteMic();
        console.log('Microphone unmuted');
        setIsMuted(false);
      } else {
        await sdkInstanceRef.current.muteMic();
        console.log('Microphone muted');
        setIsMuted(true);
      }
    } catch (error) {
      console.log('Error toggling mute', error);
    }
  };

  const toggleCamera = async () => {
    try {
      console.log('Toggling camera', {
        currentState: isCameraOff,
        selectedDevice: selectedVideoDeviceId,
      });
      if (isCameraOff) {
        await sdkInstanceRef.current.enableCam({
          deviceId: selectedVideoDeviceId,
        });
        console.log('Camera enabled');
        setIsCameraOff(false);
      } else {
        await sdkInstanceRef.current.disableCam();
        console.log('Camera disabled');
        setIsCameraOff(true);
      }
    } catch (error) {
      console.log('Error toggling camera', error);
    }
  };

  const toggleScreenShare = async () => {
    try {
      console.log('Toggling screen share', {currentState: isScreenSharing});
      if (isScreenSharing) {
        await sdkInstanceRef.current.disableShare();
        console.log('Screen sharing disabled');
        setIsScreenSharing(false);
      } else {
        await sdkInstanceRef.current.enableShare();
        console.log('Screen sharing enabled');
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.log('Error toggling screen share', error);
    }
  };

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        await sdkInstanceRef.current.stopRecording();
        console.log('Recording Ended');
      } else {
        await sdkInstanceRef.current.startRecording({
          recordingType: 'av',
        });
        console.log('Recording started');
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      Alert.alert('Error', 'Failed to toggle recording: ' + (error.message || 'Unknown error'));
    }
  };

  const changeAudioDevice = async deviceId => {
    try {
      console.log('Changing audio device', {
        currentDevice: selectedAudioDeviceId,
        newDevice: deviceId,
      });
      await sdkInstanceRef.current.changeAudioInput({deviceId});
      console.log('Audio device changed successfully');
      setSelectedAudioDeviceId(deviceId);
    } catch (error) {
      console.log('Error changing audio device', error);
    }
  };

  const changeVideoDevice = async deviceId => {
    try {
      console.log('Changing video device', {
        currentDevice: selectedVideoDeviceId,
        newDevice: deviceId,
      });
      await sdkInstanceRef.current.changeVideoInput({deviceId});
      console.log('Video device changed successfully');
      setSelectedVideoDeviceId(deviceId);
    } catch (error) {
      console.log('Error changing video device', error);
    }
  };

  const showThankYouMessage = () => {
    console.log('Showing thank you message');
    Alert.alert('Thank You', 'Thanks for trying our demo', [{text: 'OK'}], {
      cancelable: true,
    });
  };

  const renderPeerVideo = peer => {
    console.log('Rendering peer video', {
      peerId: peer.peerId,
      hasVideoTrack: !!peer.videoTrack,
      isMuted: peer.isMuted,
      isCameraOff: peer.isCameraOff,
    });

    return (
      <View style={styles.peerCard} key={peer.peerId}>
        <Text style={styles.peerName}>{peer.peerName}</Text>
        {peer.videoTrack ? (
          <RTCView
            streamURL={peer.videoTrack.toURL()}
            style={styles.videoView}
            objectFit="cover"
          />
        ) : (
          <View style={styles.noVideoContainer}>
            <Text style={styles.noVideoText}>No Video</Text>
          </View>
        )}
        {peer.isMuted && <Text style={styles.muteIndicator}>Muted</Text>}
        {peer.isCameraOff && (
          <Text style={styles.cameraOffIndicator}>Camera Off</Text>
        )}
        {isModeratorRole && peer.peerId !== localPeerId && (
          <View style={styles.inlineOptions}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => handleUpgradeParticipantPress(peer.peerId)}>
              <Text style={styles.smallButtonText}>Upgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => handleDowngradeParticipantPress(peer.peerId)}>
              <Text style={styles.smallButtonText}>Downgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => handleModeratorSendUpgradeRequest(peer.peerId, true)}>
              <Text style={styles.smallButtonText}>Request</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderScreenShare = share => {
    console.log('Rendering screen share', {
      peerId: share.peerId,
      hasVideoTrack: !!share.videoTrack,
    });

    return (
      <View style={styles.screenShareCard} key={share.peerId}>
        <Text style={styles.screenShareTitle}>Screen Share</Text>
        {share.videoTrack ? (
          <RTCView
            streamURL={share.videoTrack.toURL()}
            style={styles.screenShareView}
            objectFit="contain"
          />
        ) : (
          <View style={styles.noScreenShareContainer}>
            <Text style={styles.noScreenShareText}>No Screen Share</Text>
          </View>
        )}
      </View>
    );
  };

  const peersArray = Array.from(peers.values());
  const screenSharesArray = Array.from(screenShares.values());
  const roleOptions =
    roomType === 'event'
      ? ['moderator', 'presenter', 'attendee']
      : ['moderator', 'participant'];
  const chatTargets = ['everyone', ...peersArray.map(peer => peer.peerId)];
  const waitingPeersList = waitingPeers || [];
  const pendingRequests = pendingUpgradeRequests || [];
  const stageStatusLabel = stageSettings.stageStatus
    ? 'Stage mode enabled'
    : 'Stage mode disabled';
  const localPeerId = sdkInstanceRef.current?.data?.inputParams?.peerId || 'me';

  console.log('Rendering main component', {
    peerCount: peersArray.length,
    screenShareCount: screenSharesArray.length,
    callStatus,
    isMuted,
    isCameraOff,
    isScreenSharing,
  });

  const startProcessing = async () => {
    try {
      setIsProcessing(true);
      const inputFiles = [
        {
          url: 'https://cvr-org-823047296136-1.sgp1.digitaloceanspaces.com/videos/file_example_MP4_1920_18MG.mp4',
          type: 'mp4',
        },
        {
          url: 'https://cvr-org-823047296136-1.sgp1.digitaloceanspaces.com/videos/sample-30s.mp4',
          type: 'mp4',
        },
      ];

      const res = await sdkInstanceRef.current.startProcessing({
        inputFiles,
      });
      console.log('Processing Videos Started', res);
    } catch (error) {
      console.error('Error starting processing:', error);
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Enter Room ID"
            value={roomId}
            onChangeText={text => {
              console.log('Room ID changed', {roomId: text});
              setRoomId(text);
            }}
          />
          <TextInput
            style={styles.input}
            placeholder="Your Name"
            value={peerName}
            onChangeText={text => {
              console.log('Peer name changed', {peerName: text});
              setPeerName(text);
            }}
          />

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Room Type</Text>
            <View style={styles.inlineOptions}>
              {['conferencing', 'event', 'p2p'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pillButton,
                    roomType === type && styles.pillButtonActive,
                  ]}
                  onPress={() => setRoomType(type)}>
                  <Text
                    style={[
                      styles.pillButtonText,
                      roomType === type && styles.pillButtonTextActive,
                    ]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Join As</Text>
            <View style={styles.inlineOptions}>
              {roleOptions.map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.pillButton,
                    participantRole === role && styles.pillButtonActive,
                  ]}
                  onPress={() => setParticipantRole(role)}>
                  <Text
                    style={[
                      styles.pillButtonText,
                      participantRole === role && styles.pillButtonTextActive,
                    ]}>
                    {role.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              {resolvedPeerType === 'attendee'
                ? 'Attendees join in view-only mode.'
                : 'Moderators and presenters can publish audio/video.'}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            {!isRoomInitialized ? (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={initRoom}
                disabled={!roomId.trim()}>
                <Text style={styles.buttonText}>Init Room</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={startCall}
                  disabled={!roomId.trim()}>
                  <Text style={styles.buttonText}>Join Room</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={startProcessing}
                  disabled={isProcessing}>
                  <Text style={styles.buttonText}>
                    {isProcessing ? 'Processing...' : 'Start Processing'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={leaveRoom}
                  disabled={!sdkInstanceRef.current}>
                  <Text style={styles.buttonText}>Leave Room</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.statusText}>{callStatus}</Text>

          <TouchableOpacity
            style={styles.deviceButton}
            onPress={() => {
              console.log('Opening device selection modal');
              setShowDeviceModal(true);
            }}>
            <Text style={styles.deviceButtonText}>Select Devices</Text>
          </TouchableOpacity>

          {sdkInstanceRef.current && (
            <View style={styles.mediaControls}>
              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isMuted && styles.activeMediaButton,
                ]}
                onPress={toggleMute}
                disabled={!canProduceMedia}>
                <Text style={styles.mediaButtonText}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isCameraOff && styles.activeMediaButton,
                ]}
                onPress={toggleCamera}
                disabled={!canProduceMedia}>
                <Text style={styles.mediaButtonText}>
                  {isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isScreenSharing && styles.activeMediaButton,
                ]}
                onPress={toggleScreenShare}
                disabled={!canProduceMedia}>
                <Text style={styles.mediaButtonText}>
                  {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isRecording && styles.activeMediaButton,
                ]}
                onPress={toggleRecording}
                disabled={!isModeratorRole}>
                <Text style={styles.mediaButtonText}>
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingText}>Recording in Progress</Text>
            </View>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Engagement</Text>
            <View style={styles.inlineOptions}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={toggleHandRaise}>
                <Text style={styles.smallButtonText}>
                  {handRaised ? 'Lower Hand' : 'Raise Hand'}
                </Text>
              </TouchableOpacity>
              {resolvedPeerType === 'attendee' && (
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={requestPresenterUpgrade}>
                  <Text style={styles.smallButtonText}>Request Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.emojiRow}>
              {emojiList.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => sendReaction(emoji)}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recentReactions.length > 0 && (
              <View style={styles.reactionList}>
                {recentReactions.slice(-6).reverse().map(reaction => (
                  <Text key={reaction.id} style={styles.reactionText}>
                    {reaction.from}: {reaction.emoji}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {handRaiseEvents.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Hands Raised</Text>
              {handRaiseEvents.map(event => (
                <View key={event.peerId} style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>
                    {event.peerName}{' '}
                    {event.upgradeRequest ? '(Upgrade request)' : ''}
                  </Text>
                  {isModeratorRole && (
                    <View style={styles.inlineOptions}>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => handleUpgradeParticipantPress(event.peerId)}>
                        <Text style={styles.smallButtonText}>Upgrade</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => lowerParticipantHand(event.peerId)}>
                        <Text style={styles.smallButtonText}>Lower</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Chat</Text>
            <View style={styles.chatTargetRow}>
              <Text style={styles.helperText}>
                Sending to:{' '}
                {selectedChatReceiver === 'everyone'
                  ? 'Everyone'
                  : selectedChatReceiver}
              </Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setChatTargetModalVisible(true)}>
                <Text style={styles.smallButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chatLog}>
              {chatMessages.length === 0 ? (
                <Text style={styles.helperText}>No messages yet</Text>
              ) : (
                chatMessages.slice(-25).map(msg => (
                  <Text key={msg.id} style={styles.chatMessage}>
                    [{msg.scope === 'private' ? 'Private' : 'Public'}] {msg.from}:{' '}
                    {msg.text}
                  </Text>
                ))
              )}
            </View>
            <View style={styles.chatInputRow}>
              <TextInput
                style={[styles.input, styles.chatInput]}
                placeholder="Type message"
                value={chatInput}
                onChangeText={setChatInput}
              />
              <TouchableOpacity
                style={styles.smallButton}
                onPress={sendChatMessage}>
                <Text style={styles.smallButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Stage Routing</Text>
            <Text style={styles.helperText}>{stageStatusLabel}</Text>
            <View style={styles.toggleRow}>
              <Text>Enable Stage Mode</Text>
              <Switch
                value={stageSettings.stageStatus}
                onValueChange={value =>
                  setStageSettings(prev => ({...prev, stageStatus: value}))
                }
              />
            </View>
            <View style={styles.toggleRow}>
              <Text>Enable Back Stage</Text>
              <Switch
                value={stageSettings.backStageStatus}
                onValueChange={value =>
                  setStageSettings(prev => ({...prev, backStageStatus: value}))
                }
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Stage Peer IDs (comma separated)"
              value={stagePeersInput}
              onChangeText={setStagePeersInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Back Stage Peer IDs (comma separated)"
              value={backStagePeersInput}
              onChangeText={setBackStagePeersInput}
            />
            {isModeratorRole && (
              <TouchableOpacity
                style={styles.smallButton}
                onPress={applyStageSettingsChanges}>
                <Text style={styles.smallButtonText}>Apply Stage Settings</Text>
              </TouchableOpacity>
            )}
            <View style={styles.inlineOptions}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => toggleSelfStagePosition('stage')}>
                <Text style={styles.smallButtonText}>Go On Stage</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => toggleSelfStagePosition('backstage')}>
                <Text style={styles.smallButtonText}>Back Stage</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isModeratorRole && (
            <>
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>General Permissions</Text>
                <View style={styles.toggleRow}>
                  <Text>Allow Screen Share</Text>
                  <Switch
                    value={generalPermissions.allowScreenShare}
                    onValueChange={value =>
                      setGeneralPermissions(prev => ({
                        ...prev,
                        allowScreenShare: value,
                      }))
                    }
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Max Screen Shares"
                  keyboardType="numeric"
                  value={String(generalPermissions.noOfScreenShare)}
                  onChangeText={value =>
                    setGeneralPermissions(prev => ({
                      ...prev,
                      noOfScreenShare: Number(value) || 0,
                    }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Max Upgrade Requests"
                  keyboardType="numeric"
                  value={String(generalPermissions.noOfUpgradeRequests)}
                  onChangeText={value =>
                    setGeneralPermissions(prev => ({
                      ...prev,
                      noOfUpgradeRequests: Number(value) || 0,
                    }))
                  }
                />
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={applyGeneralPermissions}>
                  <Text style={styles.smallButtonText}>Save General</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Presenter Permissions</Text>
                {Object.entries(presenterPermissions).map(([key, value]) => (
                  <View style={styles.toggleRow} key={key}>
                    <Text>{key}</Text>
                    <Switch
                      value={!!value}
                      onValueChange={toggleValue =>
                        setPresenterPermissions(prev => ({
                          ...prev,
                          [key]: toggleValue,
                        }))
                      }
                    />
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={applyPresenterPermissions}>
                  <Text style={styles.smallButtonText}>Save Presenter</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Participant Permissions</Text>
                {Object.entries(participantPermissionsState).map(
                  ([key, value]) => (
                    <View style={styles.toggleRow} key={key}>
                      <Text>{key}</Text>
                      <Switch
                        value={!!value}
                        onValueChange={toggleValue =>
                          setParticipantPermissionsState(prev => ({
                            ...prev,
                            [key]: toggleValue,
                          }))
                        }
                      />
                    </View>
                  ),
                )}
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={applyParticipantPermissions}>
                  <Text style={styles.smallButtonText}>Save Participants</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Transcription & Live Streaming</Text>
            <View style={styles.inlineOptions}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={
                  transcriptionActive
                    ? stopTranscriptionSession
                    : startTranscriptionSession
                }>
                <Text style={styles.smallButtonText}>
                  {transcriptionActive ? 'Stop Transcription' : 'Start Transcription'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={
                  isLiveStreaming
                    ? stopLiveStreamingSession
                    : startLiveStreamingSession
                }>
                <Text style={styles.smallButtonText}>
                  {isLiveStreaming ? 'Stop Stream' : 'Start Stream'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="RTMP URL"
              value={liveStreamUrl}
              onChangeText={setLiveStreamUrl}
            />
            <TextInput
              style={styles.input}
              placeholder="Stream Key"
              value={liveStreamKey}
              onChangeText={setLiveStreamKey}
            />
            {transcriptionEntries.length > 0 && (
              <View style={styles.chatLog}>
                {transcriptionEntries.slice(-10).map(entry => (
                  <Text key={entry.id} style={styles.chatMessage}>
                    {entry.speaker}: {entry.transcript}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {roomLocked && (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Room is currently locked</Text>
            </View>
          )}

          {isModeratorRole && waitingPeersList.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Waiting Room</Text>
              {waitingPeersList.map(peer => (
                <View key={peer.peerId} style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>
                    {peer.peerName || peer.peerId}
                  </Text>
                  <View style={styles.inlineOptions}>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() => admitWaitingPeer(peer.peerId)}>
                      <Text style={styles.smallButtonText}>Admit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() => denyWaitingPeer(peer.peerId)}>
                      <Text style={styles.smallButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {isModeratorRole && pendingRequests.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Upgrade Requests</Text>
              {pendingRequests.map(request => (
                <View key={request.peerId} style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>{request.message}</Text>
                  <View style={styles.inlineOptions}>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() => handleUpgradeParticipantPress(request.peerId)}>
                      <Text style={styles.smallButtonText}>Upgrade</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() => lowerParticipantHand(request.peerId)}>
                      <Text style={styles.smallButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {screenSharesArray.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Screen Shares</Text>
              {screenSharesArray.map(renderScreenShare)}
            </View>
          )}

          {peersArray.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Participants</Text>
              {peersArray.map(renderPeerVideo)}
            </View>
          )}
        </View>

        {/* Device Selection Modal */}
        <Modal
          visible={showDeviceModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            console.log('Closing device modal via back button');
            setShowDeviceModal(false);
          }}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Devices</Text>

              <Text style={styles.deviceSectionTitle}>Audio Devices</Text>
              {audioDevices.length > 0 ? (
                audioDevices.map(device => (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={[
                      styles.deviceOption,
                      selectedAudioDeviceId === device.deviceId &&
                        styles.selectedDevice,
                    ]}
                    onPress={() => {
                      console.log('Audio device selected', {
                        deviceId: device.deviceId,
                        label: device.label,
                      });
                      changeAudioDevice(device.deviceId);
                    }}>
                    <Text style={styles.deviceOptionText}>{device.label}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDevicesText}>
                  No audio devices available
                </Text>
              )}

              <Text style={styles.deviceSectionTitle}>Video Devices</Text>
              {videoDevices.length > 0 ? (
                videoDevices.map(device => (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={[
                      styles.deviceOption,
                      selectedVideoDeviceId === device.deviceId &&
                        styles.selectedDevice,
                    ]}
                    onPress={() => {
                      console.log('Video device selected', {
                        deviceId: device.deviceId,
                        label: device.label,
                      });
                      changeVideoDevice(device.deviceId);
                    }}>
                    <Text style={styles.deviceOptionText}>{device.label}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDevicesText}>
                  No video devices available
                </Text>
              )}

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => {
                  console.log('Closing device modal');
                  setShowDeviceModal(false);
                }}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={chatTargetModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setChatTargetModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Send chat to</Text>
              {chatTargets.map(target => {
                const displayName =
                  target === 'everyone'
                    ? 'Everyone'
                    : peersRef.current.get(target)?.peerName || target;
                return (
                  <TouchableOpacity
                    key={target}
                    style={[
                      styles.deviceOption,
                      selectedChatReceiver === target && styles.selectedDevice,
                    ]}
                    onPress={() => {
                      setSelectedChatReceiver(target);
                      setChatTargetModalVisible(false);
                    }}>
                    <Text style={styles.deviceOptionText}>{displayName}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setChatTargetModalVisible(false)}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
  inputSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#4285F4',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#EA4335',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
  deviceButton: {
    backgroundColor: '#34A853',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  mediaControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FBBC05',
    marginHorizontal: 4,
  },
  activeMediaButton: {
    backgroundColor: '#555',
  },
  mediaButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pillButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  pillButtonActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  pillButtonText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  pillButtonTextActive: {
    color: '#fff',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  helperText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  emojiButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    marginRight: 6,
    marginBottom: 6,
  },
  emojiText: {
    fontSize: 18,
  },
  reactionList: {
    marginTop: 4,
  },
  reactionText: {
    fontSize: 12,
    color: '#475569',
  },
  noticeCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  noticeTitle: {
    fontWeight: '600',
    color: '#1e1b4b',
    marginBottom: 6,
  },
  peerCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  peerName: {
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#f9f9f9',
  },
  videoView: {
    height: 200,
    backgroundColor: '#000',
  },
  noVideoContainer: {
    height: 200,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: 'white',
    fontSize: 16,
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: 'white',
  },
  cameraOffIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: 'white',
  },
  screenShareCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  screenShareTitle: {
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#f0f8ff',
  },
  screenShareView: {
    height: 240,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    marginRight: 8,
    marginBottom: 8,
  },
  smallButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  chatTargetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatLog: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  chatMessage: {
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 4,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    marginRight: 8,
  },
  noScreenShareContainer: {
    height: 240,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noScreenShareText: {
    color: 'white',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  deviceSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  deviceOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  selectedDevice: {
    backgroundColor: '#e0e0ff',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  deviceOptionText: {
    fontSize: 14,
  },
  noDevicesText: {
    fontStyle: 'italic',
    color: '#888',
    marginBottom: 12,
  },
  closeModalButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingIndicator: {
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
    alignItems: 'center',
  },
  recordingText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default App;
