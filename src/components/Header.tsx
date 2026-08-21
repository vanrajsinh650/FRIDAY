import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';

interface Props {
  title: string;
  onNavigateSettings?: () => void;
  onNavigateTelemetry?: () => void;
}

export const Header: React.FC<Props> = ({ title, onNavigateSettings, onNavigateTelemetry }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.actions}>
        {onNavigateTelemetry && (
          <TouchableOpacity onPress={onNavigateTelemetry} style={styles.button}>
            <Text style={styles.buttonText}>📊 HUD</Text>
          </TouchableOpacity>
        )}
        {onNavigateSettings && (
          <TouchableOpacity onPress={onNavigateSettings} style={styles.button}>
            <Text style={styles.buttonText}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  title: {
    color: Colors.hudCyan,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
});
