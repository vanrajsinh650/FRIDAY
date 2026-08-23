import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { AgentState } from '../state/agentStore';

interface Props {
  state: AgentState;
  onPress: () => void;
}

export const HolographicOrb: React.FC<Props> = ({ state, onPress }) => {
  const isIdle = state === 'IDLE';
  const isSpeakingOrSuccess = state === 'SPEAKING' || state === 'SUCCESS';
  const isExecuting = state === 'EXECUTING';
  const isThinking = state === 'THINKING' || state === 'PLANNING';
  const isVerifying = state === 'VERIFYING';
  const isError = state === 'ERROR';

  let activeColor = Colors.hudCyan;
  let activeDimColor = Colors.hudCyanDim;

  if (isSpeakingOrSuccess) {
    activeColor = Colors.hudGreen;
    activeDimColor = 'rgba(0, 255, 136, 0.25)';
  } else if (isExecuting) {
    activeColor = Colors.hudOrange;
    activeDimColor = 'rgba(255, 170, 0, 0.25)';
  } else if (isThinking) {
    activeColor = Colors.hudBlue;
    activeDimColor = 'rgba(0, 119, 255, 0.25)';
  } else if (isVerifying) {
    activeColor = Colors.hudCyan;
    activeDimColor = 'rgba(0, 240, 255, 0.35)';
  } else if (isError) {
    activeColor = Colors.hudRed;
    activeDimColor = 'rgba(255, 51, 102, 0.25)';
  }

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.container}>
      <View
        style={[
          styles.outerRing,
          { borderColor: !isIdle ? activeColor : Colors.hudCyanDim },
        ]}
      >
        <View
          style={[
            styles.middleRing,
            { borderColor: !isIdle ? activeColor : Colors.hudBlue },
          ]}
        >
          <View
            style={[
              styles.coreOrb,
              {
                borderColor: !isIdle ? activeColor : Colors.hudCyan,
                backgroundColor: !isIdle ? activeDimColor : Colors.hudCyanDim,
              },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  outerRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: Colors.hudCyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: Colors.hudBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreOrb: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.hudCyanDim,
    borderWidth: 2,
    borderColor: Colors.hudCyan,
  },
});
