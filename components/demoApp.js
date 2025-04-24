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
} from 'react-native';
import axios from 'axios';
import samvyo from 'basic-rn-sdk-3.0';
import {RTCView} from 'react-native-webrtc';

const App = () => {
  // Basic state
  const [callStatus, setCallStatus] = useState('');
  const [roomId, setRoomId] = useState('');
  const [peerName, setPeerName] = useState('peer-1');
  const sdkInstanceRef = useRef(null);
  let sdkInstance = null;

  // Device management
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // Peer management
  const [peers, setPeers] = useState(new Map());
  const [screenShares, setScreenShares] = useState(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Input params (similar to JS SDK)
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

  useEffect(() => {
    getAllDevices();
  }, []);

  const getAllDevices = async () => {
    try {
      const availableDevices = await samvyo.RNSdk.listDevices();
      if (availableDevices.success) {
        setAudioDevices(availableDevices.deviceList.audioDevices);
        setVideoDevices(availableDevices.deviceList.videoDevices);

        // Set default devices
        if (availableDevices.deviceList.audioDevices.length > 0) {
          setSelectedAudioDeviceId(
            availableDevices.deviceList.audioDevices[0].deviceId,
          );
        }
        if (availableDevices.deviceList.videoDevices.length > 0) {
          setSelectedVideoDeviceId(
            availableDevices.deviceList.videoDevices[0].deviceId,
          );
        }
      }
      console.log('Available devices:', availableDevices);
    } catch (error) {
      console.error('Error getting devices:', error);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const cameraGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to your camera for video calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        const audioGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'App needs access to your microphone for calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (
          cameraGranted === PermissionsAndroid.RESULTS.GRANTED &&
          audioGranted === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          Alert.alert(
            'Permissions Denied',
            'Camera and Audio permissions are required to start the call.',
          );
          return false;
        }
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    } else {
      // For iOS
      return true;
    }
  };

  const fetchSessionToken = async () => {
    try {
      const data = {roomId};
      const apiUrl =
        Platform.OS === 'android'
          ? 'http://198.168.0.101:3000/api/create-session-token'
          : 'http://localhost:3000/api/create-session-token';

      const response = await axios.post(apiUrl, data);

      if (response.data.success) {
        return response.data.sessionToken;
      } else {
        Alert.alert('Error', 'Failed to fetch session token');
        return null;
      }
    } catch (error) {
      console.error('Error while creating session token:', error);
      Alert.alert('Error', 'Internal Server Error');
      return null;
    }
  };

  const startCall = async () => {
    if (!roomId.trim()) {
      Alert.alert('Error', 'Room ID cannot be empty');
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    const sessionToken = await fetchSessionToken();
    if (!sessionToken) {
      console.log('session token not found');
      return;
    }

    try {
      const roomParams = {
        sessionToken,
        roomId,
        produce: true,
        consume: true,
        produceAudio: inputParams.produceAudio,
        produceVideo: inputParams.produceVideo,
        audioDeviceId: selectedAudioDeviceId,
        videoDeviceId: selectedVideoDeviceId,
        ...inputParams,
      };

      setCallStatus('Joining room...');

      sdkInstance = await samvyo.RNSdk.joinRoom(roomParams);
      sdkInstanceRef.current = sdkInstance;

      console.log('Joined Room:', sdkInstance);
      setCallStatus('Call started successfully!');

      sdkInstance.on('newPeer', ({peerId, peerName, type}) => {
        console.log(`New peer joined: ${peerName} (ID: ${peerId})`);
        addPeer(peerId, peerName, type);
      });

      sdkInstance.on('videoStart', ({peerId, videoTrack, type}) => {
        console.log(`Video started for peer: ${peerId}`);
        updatePeerVideo(peerId, videoTrack, type);
      });

      sdkInstance.on('videoEnd', ({peerId, type}) => {
        console.log(`Video ended for peer: ${peerId}`);
        removePeerVideo(peerId, type);
      });

      sdkInstance.on('deviceListUpdated', () => {
        console.log('Device list updated');
        getAllDevices();
      });

      sdkInstance.on('micStart', ({peerId, audioTrack, type}) => {
        console.log(`Mic started for peer: ${peerId}`);
        updatePeerAudio(peerId, audioTrack, type);
      });

      sdkInstance.on('micEnd', ({peerId}) => {
        console.log(`Mic ended for peer: ${peerId}`);
        removePeerAudio(peerId);
      });

      sdkInstance.on('peerMuted', ({peerId, type}) => {
        console.log(`Peer muted: ${peerId}`);
        updatePeerMuteStatus(peerId, true);
      });

      sdkInstance.on('peerUnMuted', ({peerId, type}) => {
        console.log(`Peer unmuted: ${peerId}`);
        updatePeerMuteStatus(peerId, false);
      });

      sdkInstance.on('peerLeft', ({peerId}) => {
        console.log(`Peer left: ${peerId}`);
        removePeer(peerId);
      });

      sdkInstance.on('ssVideoStart', ({peerId, videoTrack, type}) => {
        console.log('Received screen share start');
        addScreenShare(peerId, videoTrack, type);
      });

      sdkInstance.on('ssVideoStop', ({peerId, videoTrack, type}) => {
        console.log('Received screen share stop');
        removeScreenShare(peerId);
      });

      sdkInstance.on('error', ({code, text}) => {
        console.error('Error code:', code, 'Error text:', text);
        Alert.alert('Error', `${text} (Code: ${code})`);
      });
    } catch (err) {
      console.error('Join room error:', err);
      setCallStatus('Failed to join room.');
      Alert.alert('Error', err.message || 'Failed to join');
    }
  };

  const leaveRoom = async () => {
    try {
      if (sdkInstanceRef.current) {
        const response = await sdkInstance.leaveRoom();
        console.log('Leave Room:', response);
        setCallStatus('Left room successfully!');
        Alert.alert('Success', 'Successfully left the room!');

        // Clear all peer data
        setPeers(new Map());
        setScreenShares(new Map());
        sdkInstanceRef.current = null;

        // Show thank you message
        showThankYouMessage();
      }
    } catch (err) {
      console.error('Leave room error:', err);
      setCallStatus('Failed to leave room.');
      Alert.alert('Error', err.message || 'Failed to leave');
    }
  };

  // Peer management functions
  const addPeer = (peerId, peerName, type) => {
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
      return newPeers;
    });
  };

  const updatePeerVideo = (peerId, videoTrack, type) => {
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.videoTrack = videoTrack;
        peer.isCameraOff = false;
      }
      return newPeers;
    });
  };

  const removePeerVideo = (peerId, type) => {
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.videoTrack = null;
        peer.isCameraOff = true;
      }
      return newPeers;
    });
  };

  const updatePeerAudio = (peerId, audioTrack, type) => {
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.audioTrack = audioTrack;
        peer.isMuted = false;
      }
      return newPeers;
    });
  };

  const removePeerAudio = peerId => {
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.audioTrack = null;
      }
      return newPeers;
    });
  };

  const updatePeerMuteStatus = (peerId, isMuted) => {
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.isMuted = isMuted;
      }
      return newPeers;
    });
  };

  const removePeer = peerId => {
    setPeers(prevPeers => {
      const newPeers = new Map(prevPeers);
      newPeers.delete(peerId);
      return newPeers;
    });
  };

  // Screen share functions
  const addScreenShare = (peerId, videoTrack, type) => {
    setScreenShares(prevShares => {
      const newShares = new Map(prevShares);
      newShares.set(peerId, {
        peerId,
        videoTrack,
        type,
      });
      return newShares;
    });
  };

  const removeScreenShare = peerId => {
    setScreenShares(prevShares => {
      const newShares = new Map(prevShares);
      newShares.delete(peerId);
      return newShares;
    });
  };

  // Media control functions
  const toggleMute = async () => {
    try {
      if (isMuted) {
        await sdkInstance.unmuteMic();
        setIsMuted(false);
      } else {
        await sdkInstance.muteMic();
        setIsMuted(true);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleCamera = async () => {
    try {
      if (isCameraOff) {
        await sdkInstance.enableCam({deviceId: selectedVideoDeviceId});
        setIsCameraOff(false);
      } else {
        await sdkInstance.disableCam();
        setIsCameraOff(true);
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await sdkInstance.disableShare();
        setIsScreenSharing(false);
      } else {
        await sdkInstance.enableShare();
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const changeAudioDevice = async deviceId => {
    try {
      await sdkInstance.changeAudioInput({deviceId});
      setSelectedAudioDeviceId(deviceId);
    } catch (error) {
      console.error('Error changing audio device:', error);
    }
  };

  const changeVideoDevice = async deviceId => {
    try {
      await sdkInstance.changeVideoInput({deviceId});
      setSelectedVideoDeviceId(deviceId);
    } catch (error) {
      console.error('Error changing video device:', error);
    }
  };

  const showThankYouMessage = () => {
    Alert.alert('Thank You', 'Thanks for trying our demo', [{text: 'OK'}], {
      cancelable: true,
    });
  };

  // Render peer video component
  const renderPeerVideo = peer => {
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
      </View>
    );
  };

  // Render screen share component
  const renderScreenShare = share => {
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

  // Convert Map to Array for rendering
  const peersArray = Array.from(peers.values());
  const screenSharesArray = Array.from(screenShares.values());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Input Section */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Enter Room ID"
            value={roomId}
            onChangeText={setRoomId}
          />
          <TextInput
            style={styles.input}
            placeholder="Your Name"
            value={peerName}
            onChangeText={setPeerName}
          />

          {/* Controls */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={startCall}
              disabled={!roomId.trim()}>
              <Text style={styles.buttonText}>Join Room</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={leaveRoom}
              disabled={!sdkInstanceRef.current}>
              <Text style={styles.buttonText}>Leave Room</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.statusText}>{callStatus}</Text>
        </View>

        {/* Device Selection Button */}
        <TouchableOpacity
          style={styles.deviceButton}
          onPress={() => setShowDeviceModal(true)}>
          <Text style={styles.deviceButtonText}>Select Devices</Text>
        </TouchableOpacity>

        {/* Media Controls - Only show when in a call */}
        {sdkInstanceRef.current && (
          <View style={styles.mediaControls}>
            <TouchableOpacity
              style={[styles.mediaButton, isMuted && styles.activeMediaButton]}
              onPress={toggleMute}>
              <Text style={styles.mediaButtonText}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mediaButton,
                isCameraOff && styles.activeMediaButton,
              ]}
              onPress={toggleCamera}>
              <Text style={styles.mediaButtonText}>
                {isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mediaButton,
                isScreenSharing && styles.activeMediaButton,
              ]}
              onPress={toggleScreenShare}>
              <Text style={styles.mediaButtonText}>
                {isScreenSharing ? 'Stop Share' : 'Share Screen'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Screen Shares Section */}
        {screenSharesArray.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Screen Shares</Text>
            {screenSharesArray.map(renderScreenShare)}
          </View>
        )}

        {/* Peers Section */}
        {peersArray.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {peersArray.map(renderPeerVideo)}
          </View>
        )}
      </ScrollView>

      {/* Device Selection Modal */}
      <Modal
        visible={showDeviceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeviceModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Devices</Text>

            {/* Audio Device Selection */}
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
                  onPress={() => changeAudioDevice(device.deviceId)}>
                  <Text style={styles.deviceOptionText}>{device.label}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noDevicesText}>
                No audio devices available
              </Text>
            )}

            {/* Video Device Selection */}
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
                  onPress={() => changeVideoDevice(device.deviceId)}>
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
              onPress={() => setShowDeviceModal(false)}>
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
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
    backgroundColor: '#000',
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
});

export default App;
