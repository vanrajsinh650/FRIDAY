import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../app/theme';
import { useUpdateStore } from '../state/updateStore';
import { InAppUpdateService } from '../services/InAppUpdateService';

export const UpdateModal: React.FC = () => {
  const isVisible = useUpdateStore((s) => s.isModalVisible);
  const status = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const downloadPercent = useUpdateStore((s) => s.downloadPercent);
  const errorMessage = useUpdateStore((s) => s.errorMessage);
  const forceUpdate = useUpdateStore((s) => s.forceUpdate);

  if (!isVisible) return null;

  const isDownloading = status === 'DOWNLOADING';
  const isReady = status === 'READY_TO_INSTALL';
  const isError = status === 'ERROR';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!forceUpdate && !isDownloading) {
          InAppUpdateService.dismiss();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Cybernetic Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🚀</Text>
            <View>
              <Text style={styles.headerTitle}>FRIDAY SYSTEM UPDATE</Text>
              <Text style={styles.headerSubtitle}>New capabilities ready to deploy</Text>
            </View>
          </View>

          {/* Version Badge Row */}
          <View style={styles.versionRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionLabel}>INSTALLED</Text>
              <Text style={styles.versionValue}>v{currentVersion}</Text>
            </View>
            <Text style={styles.arrowIcon}>➔</Text>
            <View style={[styles.versionBadge, styles.newVersionBadge]}>
              <Text style={[styles.versionLabel, styles.newVersionLabel]}>LATEST</Text>
              <Text style={[styles.versionValue, styles.newVersionValue]}>v{latestVersion || '1.1.0'}</Text>
            </View>
          </View>

          {/* Changelog / Release Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesHeader}>RELEASE NOTES & CHANGELOG</Text>
            <ScrollView style={styles.notesScroll} contentContainerStyle={styles.notesContent}>
              <Text style={styles.notesText}>
                {releaseNotes ||
                  '• Neural core response optimization\n• Dynamic toolchain execution upgrades\n• Stability and performance improvements\n• Offline wake-word detection tuning'}
              </Text>
            </ScrollView>
          </View>

          {/* Download Progress Bar */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressLabel}>DOWNLOADING UPDATE PACKAGE...</Text>
                <Text style={styles.progressPercent}>{downloadPercent}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(5, downloadPercent))}%` as any }]} />
              </View>
            </View>
          )}

          {/* Error Message */}
          {isError && errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {!forceUpdate && !isDownloading && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => InAppUpdateService.dismiss()}
              >
                <Text style={styles.cancelButtonText}>LATER</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.updateButton,
                isDownloading && styles.updateButtonDisabled,
              ]}
              disabled={isDownloading}
              onPress={() => InAppUpdateService.startDownloadAndInstall()}
            >
              {isDownloading ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={styles.updateButtonText}> DOWNLOADING...</Text>
                </View>
              ) : (
                <Text style={styles.updateButtonText}>
                  {isReady ? '⚡ INSTALL UPDATE' : isError ? '🔄 RETRY UPDATE' : '⚡ UPDATE NOW'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.hudCyan,
    padding: 20,
    shadowColor: Colors.hudCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    color: Colors.hudCyan,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    color: Colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  versionBadge: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  newVersionBadge: {
    borderColor: Colors.hudCyan,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  arrowIcon: {
    color: Colors.hudCyan,
    fontSize: 18,
    marginHorizontal: 8,
    fontWeight: 'bold',
  },
  versionLabel: {
    color: Colors.textDim,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  newVersionLabel: {
    color: Colors.hudCyan,
  },
  versionValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
  newVersionValue: {
    color: Colors.hudCyan,
  },
  notesContainer: {
    backgroundColor: 'rgba(10, 20, 32, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    marginBottom: 16,
  },
  notesHeader: {
    color: Colors.hudCyan,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesScroll: {
    maxHeight: 120,
  },
  notesContent: {
    paddingVertical: 2,
  },
  notesText: {
    color: Colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: Colors.hudCyan,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  progressPercent: {
    color: Colors.hudCyan,
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.hudCyan,
    borderRadius: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: 'bold',
  },
  updateButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.hudCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
