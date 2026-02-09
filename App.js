import React from 'react';
import { SdkProvider } from './src/contexts/SdkContext';
import ConferenceScreen from './src/screens/ConferenceScreen';

const App = () => {
  return (
    <SdkProvider>
      <ConferenceScreen />
    </SdkProvider>
  );
};

export default App;
