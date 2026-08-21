import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { AgentState } from '../state/agentStore';

interface Props {
  state: AgentState;
}

export const StatusBanner: React.FC<Props> = ({ state }) => {
  const getStatusColor = () => {
    switch (state) {
      case 'LISTENING': return Colors.hudCyan;
      case 'THINKING':
      case 'PLANNING': return Colors.hudBlue;
      case 'EXECUTING': return Colors.hudOrange;
      case 'VERIFYING': return Colors.hudCyan;
      case 'SPEAKING': return Colors.hudGreen;
      case 'ERROR': return Colors.hudRed;
      default: return Colors.textDim;
    }
  };

  return (
    <View style={[styles.container, { borderColor: getStatusColor() }]}>
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.text, { color: getStatusColor() }]}>
        {state}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.cardBackground,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
