import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { AgentStep } from '../state/agentStore';
import { SessionManager } from '../agent/session/sessionManager';

interface Props {
  goal: string;
  steps: AgentStep[];
  onCancel?: () => void;
}

export const HolographicTaskTimeline: React.FC<Props> = ({
  goal,
  steps,
  onCancel,
}) => {
  const handleStop = () => {
    SessionManager.cancelCurrentSession();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.liveTag}>
          <Text style={styles.liveDot}>●</Text>
          <Text style={styles.liveText}>EXECUTING TASK</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={handleStop} style={styles.stopButton}>
          <Text style={styles.stopText}>■ STOP</Text>
        </TouchableOpacity>
      </View>

      <Text numberOfLines={2} style={styles.goalText}>
        "{goal}"
      </Text>

      {/* Steps List */}
      <View style={styles.stepsContainer}>
        {steps.slice(-3).map((step, index) => (
          <View key={step.id || index} style={styles.stepRow}>
            <Text style={styles.stepDot}>➔</Text>
            <Text numberOfLines={1} style={styles.stepTool}>
              {step.toolName}: <Text style={styles.stepDesc}>{step.description || 'Executing action...'}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(13, 21, 39, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hudOrange,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    color: Colors.hudOrange,
    fontSize: 10,
  },
  liveText: {
    color: Colors.hudOrange,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  stopButton: {
    backgroundColor: 'rgba(255, 51, 102, 0.2)',
    borderColor: Colors.hudRed,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stopText: {
    color: Colors.hudRed,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  goalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
    marginBottom: 8,
  },
  stepsContainer: {
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    color: Colors.hudCyan,
    fontSize: 11,
  },
  stepTool: {
    color: Colors.hudCyan,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  stepDesc: {
    color: '#8B9BB4',
    fontWeight: '400',
  },
});
