import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { useTelemetryStore } from '../state/telemetryStore';

export const DebugTelemetryScreen: React.FC = () => {
  const metrics = useTelemetryStore((s) => s.currentMetrics);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>REAL-TIME TELEMETRY GAUGE</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Wake Latency</Text>
          <Text style={styles.metricValue}>{metrics.wakeDetectionMs} ms</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>STT First Token</Text>
          <Text style={styles.metricValue}>{metrics.sttFirstTokenMs} ms</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Time to 1st Action</Text>
          <Text style={styles.metricValue}>{metrics.timeToFirstActionMs} ms</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>LLM TTFT</Text>
          <Text style={styles.metricValue}>{metrics.llmTimeFirstTokenMs} ms</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  header: { color: Colors.hudCyan, fontSize: 14, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 16 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', backgroundColor: Colors.cardBackground, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, padding: 12 },
  metricLabel: { color: Colors.textDim, fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  metricValue: { color: Colors.hudCyan, fontSize: 18, fontWeight: 'bold' },
});
