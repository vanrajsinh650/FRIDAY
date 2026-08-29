import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { SystemControlModule } from '../native/SystemControlModule';

interface Props {
  title?: string;
  source?: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export const HolographicMediaWidget: React.FC<Props> = ({
  title = 'Active Audio Stream',
  source = 'Media Player',
  isPlaying = false,
  onTogglePlay,
}) => {
  const [playing, setPlaying] = useState(isPlaying);
  const [volume, setVolume] = useState(70);

  useEffect(() => {
    setPlaying(isPlaying);
  }, [isPlaying]);

  const handlePlayPause = async () => {
    const next = !playing;
    setPlaying(next);
    if (onTogglePlay) {
      onTogglePlay();
    }
  };

  const handleVolumeChange = async (delta: number) => {
    const nextVol = Math.max(0, Math.min(100, volume + delta));
    setVolume(nextVol);
    await SystemControlModule.setVolume('MEDIA', nextVol).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.sourceTag}>
          <Text style={styles.sourceText}>{source.toUpperCase()}</Text>
        </View>
        <Text style={styles.volumeText}>VOL {volume}%</Text>
      </View>

      <Text numberOfLines={1} style={styles.titleText}>
        {title}
      </Text>

      {/* Progress Track */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${volume}%` }]} />
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleVolumeChange(-10)}
          style={styles.controlBtn}
        >
          <Text style={styles.controlIcon}>🔉 -</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePlayPause}
          style={[styles.controlBtn, styles.playBtn]}
        >
          <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleVolumeChange(10)}
          style={styles.controlBtn}
        >
          <Text style={styles.controlIcon}>🔊 +</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(13, 21, 39, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
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
  sourceTag: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  sourceText: {
    color: Colors.hudCyan,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  volumeText: {
    color: '#8B9BB4',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
    marginBottom: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.hudCyan,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  playBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    borderWidth: 1,
    borderColor: Colors.hudCyan,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  controlIcon: {
    color: '#8B9BB4',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  playIcon: {
    color: Colors.hudCyan,
    fontSize: 14,
    fontWeight: '700',
  },
});
