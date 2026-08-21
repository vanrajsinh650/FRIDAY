import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { ActionStep } from '../state/agentStore';

interface Props {
  step: ActionStep;
}

export const ActionStreamCard: React.FC<Props> = ({ step }) => {
  const getBadgeColor = () => {
    switch (step.status) {
      case 'running': return Colors.hudOrange;
      case 'success': return Colors.hudGreen;
      case 'failed': return Colors.hudRed;
      default: return Colors.textDim;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.toolName}>{step.toolName}</Text>
        <Text style={[styles.statusBadge, { color: getBadgeColor() }]}>
          {step.status.toUpperCase()} {step.durationMs ? `(${step.durationMs}ms)` : ''}
        </Text>
      </View>
      <Text style={styles.description}>{step.description}</Text>
      {step.error && <Text style={styles.errorText}>Error: {step.error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  toolName: {
    color: Colors.hudCyan,
    fontWeight: 'bold',
    fontSize: 13,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  errorText: {
    color: Colors.hudRed,
    fontSize: 11,
    marginTop: 4,
  },
});
