import React, {useState} from 'react';
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
} from 'react-native';
import axios from 'axios';
import samvyo from 'basic-rn-sdk-3.0';

const App = () => {
  const [callStatus, setCallStatus] = useState('');
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [roomId, setRoomId] = useState(''); // State for roomId

  const requestPermissions = async () => {
    console.log('inside requesting permissions');
    if (Platform.OS === 'android') {
      console.log('inside android permissions');
      try {
        // Request camera permission
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

        // Request microphone permission
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

        console.log('Camera permission:', cameraGranted);
        console.log('Audio permission:', audioGranted);

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
      console.log('inside fetch session token');
      const data = {roomId};
      const response = await axios.post(
        'http://192.168.0.101:3000/api/create-session-token',
        data,
      );
      console.log('Session token response:', response);
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

  // Function to start the call
  const startCall = async () => {
    if (!roomId.trim()) {
      Alert.alert('Error', 'Room ID cannot be empty');
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    const sessionToken = await fetchSessionToken();
    if (!sessionToken) return;

    try {
      const response = await samvyo.RNSdk.listDevices();
      console.log('list devices response:', response);

      const roomParams = {
        sessionToken,
        roomId,
        produce: true,
        produceAudio: true,
        produceVideo: true,
        consume: true,
        videoResolution: 'hd',
        forceVp8: false,
        forceVp9: false,
        forceH264: false,
        h264Profile: 'high',
        forcePCMU: false,
        forcePCMA: false,
        forceFPS: 25,
        enableWebcamLayers: true,
        numSimulcastStreams: 3,
      };

      setCallStatus('Joining room...');
      const sdkInstance = await samvyo.RNSdk.joinRoom(roomParams);
      console.log('Joined Room:', sdkInstance);
      setCallStatus('Call started successfully!');

      sdkInstance.on('newPeer', ({peerId, peerName, type}) => {
        console.log(`New peer joined: ${peerName} (ID: ${peerId})`);
        // addPeer(peerId, peerName, type);
      });
      Alert.alert('Success', 'Successfully joined the room!');
    } catch (err) {
      console.error('Join room error:', err);
      setCallStatus('Failed to join room.');
      Alert.alert('Error', err.message || 'Failed to join');
    }
  };
  const leaveRoom = async () => {
    try {
      const response = await samvyo.RNSdk.leaveRoom();
      console.log('Leave Room:', response);
      setCallStatus('Left room successfully!');
      Alert.alert('Success', 'Successfully left the room!');
    } catch (err) {
      console.error('Leave room error:', err);
      setCallStatus('Failed to leave room.');
      Alert.alert('Error', err.message || 'Failed to leave');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Room ID"
          value={roomId}
          onChangeText={setRoomId}
        />
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonSpacer} />
        <Button title="Start Call" onPress={startCall} />
        <View style={styles.buttonSpacer} />
        <Button title="Leave Room" onPress={leaveRoom} />
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{callStatus}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  buttonSpacer: {
    height: 20,
  },
  statusContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
  },
});

export default App;
