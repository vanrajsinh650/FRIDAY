import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Colors } from '../app/theme';
import { useLauncherStore } from '../state/launcherStore';
import { SystemControlModule } from '../native/SystemControlModule';

export const AppActionModal: React.FC = () => {
  const selectedApp = useLauncherStore((s) => s.selectedAppForAction);
  const setSelectedApp = useLauncherStore((s) => s.setSelectedAppForAction);
  const pinnedPackages = useLauncherStore((s) => s.pinnedPackages);
  const togglePin = useLauncherStore((s) => s.togglePin);
  const hideApp = useLauncherStore((s) => s.hideApp);

  if (!selectedApp) return null;

  const isPinned = pinnedPackages.includes(selectedApp.packageName);

  const handleLaunch = () => {
    SystemControlModule.launchApp(selectedApp.packageName);
    setSelectedApp(null);
  };

  const handleTogglePin = () => {
    togglePin(selectedApp.packageName);
    setSelectedApp(null);
  };

  const handleHide = () => {
    hideApp(selectedApp.packageName);
    setSelectedApp(null);
  };

  const handleOpenSettings = () => {
    SystemControlModule.openAppSettings(selectedApp.packageName);
    setSelectedApp(null);
  };

  const handleUninstall = () => {
    SystemControlModule.uninstallApp(selectedApp.packageName);
    setSelectedApp(null);
  };

  return (
    <Modal
      visible={!!selectedApp}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedApp(null)}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => setSelectedApp(null)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          {/* App Header */}
          <View style={styles.headerRow}>
            {selectedApp.icon ? (
              <Image source={{ uri: selectedApp.icon }} style={styles.appIcon} />
            ) : (
              <View style={styles.appIconFallback}>
                <Text style={styles.appIconFallbackText}>{selectedApp.appName.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.appName} numberOfLines={1}>
                {selectedApp.appName}
              </Text>
              <Text style={styles.packageName} numberOfLines={1}>
                {selectedApp.packageName}
              </Text>
            </View>
          </View>

          {/* Action List */}
          <View style={styles.actionList}>
            <TouchableOpacity style={styles.actionItem} onPress={handleLaunch}>
              <Text style={styles.actionEmoji}>🚀</Text>
              <Text style={styles.actionText}>Launch Application</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleTogglePin}>
              <Text style={styles.actionEmoji}>{isPinned ? '📍' : '📌'}</Text>
              <Text style={[styles.actionText, isPinned && styles.actionActive]}>
                {isPinned ? 'Unpin from Quick Dock' : 'Pin to Home Quick Dock'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleOpenSettings}>
              <Text style={styles.actionEmoji}>⚙️</Text>
              <Text style={styles.actionText}>App Info & Permissions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleHide}>
              <Text style={styles.actionEmoji}>👁️</Text>
              <Text style={styles.actionText}>Hide from Screen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionItem, styles.actionItemDanger]} onPress={handleUninstall}>
              <Text style={styles.actionEmoji}>🗑️</Text>
              <Text style={[styles.actionText, styles.actionDangerText]}>Uninstall App</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedApp(null)}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.hudCyan,
    padding: 20,
    shadowColor: Colors.hudCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  appIconFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.hudCyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hudCyan,
  },
  appIconFallbackText: {
    color: Colors.hudCyan,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  packageName: {
    color: Colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  actionList: {
    marginTop: 14,
    gap: 6,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  actionItemDanger: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  actionActive: {
    color: Colors.hudCyan,
  },
  actionDangerText: {
    color: '#ef4444',
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
