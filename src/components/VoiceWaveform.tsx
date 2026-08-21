import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';

interface Props {
  rmsLevel: number;
  isActive: boolean;
}

export const VoiceWaveform: React.FC<Props> = ({ rmsLevel, isActive }) => {
  const barCount = 12;
  const bars = Array.from({ length: barCount });

  return (
    <View style={styles.container}>
      {bars.map((_, i) => {
        const heightMultiplier = Math.sin((i / barCount) * Math.PI) * (isActive ? Math.max(0.2, rmsLevel) : 0.1);
        const height = Math.max(6, heightMultiplier * 48);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: isActive ? Colors.hudCyan : Colors.textDim,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 4,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
