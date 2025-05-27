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
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [isRoomInitialized, setIsRoomInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
    console.log('App initialized, fetching devices');
    getAllDevices();
  }, []);

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
          ? 'http://10.0.2.2:3000/api/create-session-token'
          : 'http://localhost:3000/api/create-session-token';

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
        peerName,
        produce: true,
        consume: true,
        produceAudio: inputParams.produceAudio,
        produceVideo: inputParams.produceVideo,
        audioDeviceId: selectedAudioDeviceId,
        videoDeviceId: selectedVideoDeviceId,
        ...inputParams,
      };

      console.log('Room params', roomParams);
      setCallStatus('Joining room...');

      console.log('Joining room with SDK');
      console.log('SDK instance', sdkInstanceRef.current);
      await sdkInstanceRef.current.joinRoom(roomParams);

      console.log('Room joined successfully');
      setCallStatus('Call started successfully!');

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

            // Add processing completed event listener
            sdkInstanceRef.current.on('processingCompleted', (details) => {
              console.log(`Processing has been completed`, details);
              // Alert.alert('Success', 'Processing has been completed on the room');
              setIsProcessing(false);
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

      sdkInstanceRef.current.on('ssVideoStart', ({peerId, videoTrack, type}) => {
        console.log('Screen share started', {
          peerId,
          hasVideoTrack: !!videoTrack,
          videoTrackType: videoTrack ? typeof videoTrack : 'none',
          type,
        });
        addScreenShare(peerId, videoTrack, type);
      });

      sdkInstanceRef.current.on('ssVideoStop', ({peerId, videoTrack, type}) => {
        console.log('Screen share stopped', {peerId, type});
        removeScreenShare(peerId);
      });

      sdkInstanceRef.current.on('error', ({code, text}) => {
        console.log(`SDK error: ${text} (Code: ${code})`);
        Alert.alert('Error', `${text} (Code: ${code})`);
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
          url: "https://cvr-org-823047296136-1.sgp1.digitaloceanspaces.com/videos/file_example_MP4_1920_18MG.mp4",
          type: "mp4"
        },
        {
          url: "https://cvr-org-823047296136-1.sgp1.digitaloceanspaces.com/videos/sample-30s.mp4",
          type: "mp4"
        }
      ];

      await sdkInstanceRef.current.startProcessing({
        inputFiles,
      });
      console.log("Processing Videos Started");
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

            <Text style={styles.statusText}>{callStatus}</Text>
          </View>

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
