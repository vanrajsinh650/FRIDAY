import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../app/theme';
import { Header } from '../components/Header';
import { HolographicOrb } from '../components/HolographicOrb';
import { StatusBanner } from '../components/StatusBanner';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { ActionStreamCard } from '../components/ActionStreamCard';
import { useAgentStore } from '../state/agentStore';
import { useVoiceStore } from '../state/voiceStore';
import { VoicePipeline } from '../voice/voicePipeline';
import { FridayAgent } from '../agent/agent';
import { SystemControlModule } from '../native/SystemControlModule';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { InstalledApp, DeviceStats } from '../native/types';

import { PocketTTSEngine } from '../voice/tts';
import { ResponseShaper } from '../voice/responseShaper';
import { useUpdateStore } from '../state/updateStore';
import { InAppUpdateService } from '../services/InAppUpdateService';
import { UpdateModal } from '../components/UpdateModal';
import { useLauncherStore } from '../state/launcherStore';
import { AppCategorizer, AppCategoryKey, APP_CATEGORIES } from '../utils/appCategorizer';
import { AppActionModal } from '../components/AppActionModal';

export const AssistantScreen: React.FC<any> = ({ navigation }) => {
  const agentState = useAgentStore((s) => s.state);
  const activeGoal = useAgentStore((s) => s.activeGoal);
  const steps = useAgentStore((s) => s.steps);
  const lastResponse = useAgentStore((s) => s.lastResponse);
  const errorMessage = useAgentStore((s) => s.errorMessage);
  const transcriptStream = useVoiceStore((s) => s.transcriptStream);
  const isAssistantEnabled = useVoiceStore((s) => s.isAssistantEnabled);
  const updateStatus = useUpdateStore((s) => s.status);
  const latestVersion = useUpdateStore((s) => s.latestVersion);

  // Launcher state & customization store
  const pinnedPackages = useLauncherStore((s) => s.pinnedPackages);
  const hiddenPackages = useLauncherStore((s) => s.hiddenPackages);
  const selectedCategory = useLauncherStore((s) => s.selectedCategory);
  const layoutMode = useLauncherStore((s) => s.layoutMode);
  const setSelectedCategory = useLauncherStore((s) => s.setSelectedCategory);
  const setLayoutMode = useLauncherStore((s) => s.setLayoutMode);
  const setSelectedAppForAction = useLauncherStore((s) => s.setSelectedAppForAction);

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDefaultHome, setIsDefaultHome] = useState(false);
  const [isAccessibilityActive, setIsAccessibilityActive] = useState(false);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [loadingApps, setLoadingApps] = useState(true);
  const [activeTab, setActiveTab] = useState<'HOME' | 'APPS' | 'CONTROL'>('HOME');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshSystemStatus = async () => {
    try {
      const defaultHome = await SystemControlModule.isDefaultLauncher();
      setIsDefaultHome(defaultHome);

      const accessActive = await AccessibilityModule.isServiceEnabled();
      setIsAccessibilityActive(accessActive);

      const stats = await SystemControlModule.getDeviceStats();
      setDeviceStats(stats);
    } catch (_e) {
    }
  };

  const loadInstalledApps = async () => {
    setLoadingApps(true);
    try {
      const installed = await SystemControlModule.getInstalledApps();
      const sorted = installed.sort((a, b) => a.appName.localeCompare(b.appName));
      setApps(sorted);
    } catch (_e) {
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    refreshSystemStatus();
    loadInstalledApps();
    VoicePipeline.initializeWakeWordListener();
    InAppUpdateService.initialize().then(() => {
      InAppUpdateService.checkForUpdates(true).catch(() => {});
    });
    const statusInterval = setInterval(refreshSystemStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  const handleOrbPress = async () => {
    await VoicePipeline.startVoiceSession();
  };

  const handleTextCommand = async () => {
    if (!searchQuery.trim()) return;
    const command = searchQuery.trim();
    setSearchQuery('');
    const agent = new FridayAgent();
    useAgentStore.getState().setAgentState('THINKING');
    const reply = await agent.executeGoal(command);
    if (reply) {
      useAgentStore.getState().setAgentState('SPEAKING');
      try {
        const shapedReply = ResponseShaper.shape(reply);
        await PocketTTSEngine.speak({ text: shapedReply });
      } catch (_e) {}
      useAgentStore.getState().setAgentState('IDLE');
    }
  };

  const visibleApps = apps.filter((app) => !hiddenPackages.includes(app.packageName));

  const pinnedApps = visibleApps.filter((app) => pinnedPackages.includes(app.packageName));
  const quickDockApps = pinnedApps.length > 0 ? pinnedApps : visibleApps.slice(0, 5);

  const categoryGroups = AppCategorizer.groupApps(apps, pinnedPackages, hiddenPackages);

  const filteredApps = visibleApps.filter((app) => {
    const matchesSearch = !searchQuery.trim() || app.appName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'FAVORITES') return pinnedPackages.includes(app.packageName);
    return AppCategorizer.categorizeApp(app) === selectedCategory;
  });

  const toggleTorch = async () => {
    const nextState = !torchOn;
    setTorchOn(nextState);
    await SystemControlModule.setFlashlight(nextState);
  };

  return (
    <View style={styles.container}>
      <Header
        title="FRIDAY OS"
        onNavigateSettings={() => navigation.navigate('Settings')}
        onNavigateTelemetry={() => navigation.navigate('DebugTelemetry')}
        onExitApp={() => SystemControlModule.exitApplication()}
      />

      {/* Cybernetic HUD Bar: Time, Battery, Launcher & Accessibility Status */}
      <View style={styles.hudHeader}>
        <View>
          <Text style={styles.hudTime}>{currentTime}</Text>
          <Text style={styles.hudDate}>{currentDate}</Text>
        </View>

        <View style={styles.hudStats}>
          {deviceStats && (
            <>
              <Text style={styles.statText}>
                ⚡ {deviceStats.batteryLevel}% {deviceStats.isCharging ? '(CHG)' : ''}
              </Text>
              <Text style={styles.statTextDim}>
                RAM: {Math.round(((deviceStats.totalRamMb - deviceStats.availRamMb) / deviceStats.totalRamMb) * 100)}% | Free: {deviceStats.freeStorageGb}GB
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Master 24/7 Voice & Core Kill-Switch Button */}
      <TouchableOpacity
        style={[
          styles.masterPowerBtn,
          isAssistantEnabled ? styles.masterPowerActive : styles.masterPowerDisabled,
        ]}
        onPress={async () => {
          await VoicePipeline.toggleAssistant();
        }}
        activeOpacity={0.8}
      >
        <View style={styles.masterPowerContent}>
          <View style={[styles.masterPowerIndicator, isAssistantEnabled ? styles.indicatorActive : styles.indicatorDisabled]}>
            <Text style={styles.masterPowerIcon}>{isAssistantEnabled ? '⚡' : '🛑'}</Text>
          </View>
          <View style={styles.masterPowerTextCol}>
            <View style={styles.masterPowerTitleRow}>
              <Text style={[styles.masterPowerTitle, isAssistantEnabled ? styles.textGreen : styles.textRed]}>
                {isAssistantEnabled ? 'FRIDAY IS ONLINE (ACTIVE)' : 'FRIDAY IS MUTED (OFFLINE)'}
              </Text>
              <View style={[styles.statusDot, isAssistantEnabled ? styles.dotGreen : styles.dotRed]} />
            </View>
            <Text style={styles.masterPowerSub}>
              {isAssistantEnabled
                ? 'Listening 24/7 for "Friday". Tap here to fully mute & disable.'
                : 'Fully silent & disabled. Tap here to power on & resume listening.'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Update Available Alert Banner */}
      {updateStatus === 'AVAILABLE' && (
        <TouchableOpacity
          style={styles.updateBanner}
          onPress={() => useUpdateStore.getState().setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.updateBannerIcon}>🚀</Text>
          <View style={styles.updateBannerTextCol}>
            <Text style={styles.updateBannerTitle}>NEW UPDATE AVAILABLE: v{latestVersion || '1.1.0'}</Text>
            <Text style={styles.updateBannerSub}>Tap to download and deploy new system capabilities</Text>
          </View>
          <Text style={styles.updateBannerAction}>UPDATE ➔</Text>
        </TouchableOpacity>
      )}

      {/* Quick Setup Alerts: Launcher, Assistant & Accessibility */}
      <View style={styles.badgesRow}>
        <TouchableOpacity
          style={[styles.badgeBtn, isDefaultHome ? styles.badgeActive : styles.badgeActionNeeded]}
          onPress={() => SystemControlModule.openDefaultLauncherSettings()}
        >
          <Text style={styles.badgeText}>
            {isDefaultHome ? '✓ HOME LAUNCHER' : '⚙ SET HOME LAUNCHER'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.badgeBtn}
          onPress={() => SystemControlModule.openDefaultAssistantSettings()}
        >
          <Text style={styles.badgeText}>
            🎙 SET ASSISTANT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.badgeBtn, isAccessibilityActive ? styles.badgeActive : styles.badgeActionNeeded]}
          onPress={() => SystemControlModule.openAccessibilitySettings()}
        >
          <Text style={styles.badgeText}>
            {isAccessibilityActive ? '✓ ACCESSIBILITY' : '⚡ ACCESSIBILITY'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Omni Search & AI Command Input */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps or ask FRIDAY..."
          placeholderTextColor={Colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleTextCommand}
          returnKeyType="go"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.searchExecuteBtn} onPress={handleTextCommand}>
            <Text style={styles.searchExecuteText}>RUN</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Launcher Mode Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'HOME' && styles.tabItemActive]}
          onPress={() => setActiveTab('HOME')}
        >
          <Text style={[styles.tabText, activeTab === 'HOME' && styles.tabTextActive]}>AI CORE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'APPS' && styles.tabItemActive]}
          onPress={() => setActiveTab('APPS')}
        >
          <Text style={[styles.tabText, activeTab === 'APPS' && styles.tabTextActive]}>
            APPS ({apps.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'CONTROL' && styles.tabItemActive]}
          onPress={() => setActiveTab('CONTROL')}
        >
          <Text style={[styles.tabText, activeTab === 'CONTROL' && styles.tabTextActive]}>DEVICE CONTROLS</Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: AI CORE & HOME */}
      {activeTab === 'HOME' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <StatusBanner state={agentState} />

          <HolographicOrb state={agentState} onPress={handleOrbPress} />

          <VoiceWaveform isActive={agentState === 'LISTENING' || agentState === 'SPEAKING'} />

          {transcriptStream ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>VOICE TRANSCRIPT</Text>
              <Text style={styles.transcriptText}>{transcriptStream}</Text>
            </View>
          ) : null}

          {activeGoal ? (
            <View style={styles.goalBox}>
              <Text style={styles.goalLabel}>ACTIVE GOAL</Text>
              <Text style={styles.goalText}>{activeGoal}</Text>
            </View>
          ) : null}

          {steps.length > 0 && (
            <View style={styles.streamSection}>
              <Text style={styles.sectionHeader}>ACTION EXECUTION STREAM</Text>
              {steps.map((st) => (
                <ActionStreamCard key={st.id} step={st} />
              ))}
            </View>
          )}

          {errorMessage ? (
            <View style={[styles.responseBox, { borderColor: Colors.hudRed }]}>
              <Text style={[styles.responseLabel, { color: Colors.hudRed }]}>ERROR DETAILS</Text>
              <Text style={styles.responseText}>{errorMessage}</Text>
            </View>
          ) : null}

          {lastResponse ? (
            <View style={styles.responseBox}>
              <Text style={styles.responseLabel}>FRIDAY RESPONSE</Text>
              <Text style={styles.responseText}>{lastResponse}</Text>
            </View>
          ) : null}

          {/* Favorite Quick Apps Dock */}
          <View style={styles.quickDockSection}>
            <View style={styles.dockHeaderRow}>
              <Text style={styles.dockTitle}>⭐ QUICK ACCESS DOCK</Text>
              <TouchableOpacity onPress={() => setActiveTab('APPS')}>
                <Text style={styles.dockManageText}>+ MANAGE APPS</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dockScrollContent}>
              {quickDockApps.map((app) => (
                <TouchableOpacity
                  key={app.packageName}
                  style={styles.dockItem}
                  onPress={() => SystemControlModule.launchApp(app.packageName)}
                  onLongPress={() => setSelectedAppForAction(app)}
                  activeOpacity={0.7}
                >
                  {app.icon ? (
                    <Image source={{ uri: app.icon }} style={styles.dockIcon} />
                  ) : (
                    <View style={styles.dockIconFallback}>
                      <Text style={styles.dockIconText}>{app.appName.charAt(0)}</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.dockLabel}>{app.appName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Tab 2: APPS MANAGEMENT & DRAWER */}
      {activeTab === 'APPS' && (
        <View style={styles.appsContainer}>
          {/* Category Filter Chips Bar */}
          <View style={styles.filterBarContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'ALL' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('ALL')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'ALL' && styles.filterChipTextActive]}>
                  ALL ({visibleApps.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'FAVORITES' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('FAVORITES')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'FAVORITES' && styles.filterChipTextActive]}>
                  ⭐ PINNED ({pinnedApps.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'SOCIAL' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('SOCIAL')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'SOCIAL' && styles.filterChipTextActive]}>
                  💬 SOCIAL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'MEDIA' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('MEDIA')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'MEDIA' && styles.filterChipTextActive]}>
                  🎬 MEDIA
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'TOOLS' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('TOOLS')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'TOOLS' && styles.filterChipTextActive]}>
                  🛠️ TOOLS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'WORK' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('WORK')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'WORK' && styles.filterChipTextActive]}>
                  💼 WORK
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'FINANCE' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('FINANCE')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'FINANCE' && styles.filterChipTextActive]}>
                  💳 PAY & SHOP
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'GAMES' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('GAMES')}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'GAMES' && styles.filterChipTextActive]}>
                  🎮 GAMES
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Layout Mode Switcher */}
            {!searchQuery.trim() && (
              <View style={styles.layoutToggleRow}>
                <TouchableOpacity
                  style={[styles.layoutToggleBtn, layoutMode === 'CATEGORIES' && styles.layoutToggleBtnActive]}
                  onPress={() => {
                    setLayoutMode('CATEGORIES');
                    setSelectedCategory('ALL');
                  }}
                >
                  <Text style={[styles.layoutToggleText, layoutMode === 'CATEGORIES' && styles.layoutToggleTextActive]}>
                    ▦ CATEGORIES
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.layoutToggleBtn, layoutMode === 'GRID' && styles.layoutToggleBtnActive]}
                  onPress={() => setLayoutMode('GRID')}
                >
                  <Text style={[styles.layoutToggleText, layoutMode === 'GRID' && styles.layoutToggleTextActive]}>
                    ☷ ALL GRID
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {loadingApps ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.hudCyan} />
              <Text style={styles.loadingText}>Indexing & Organizing Installed Apps...</Text>
            </View>
          ) : layoutMode === 'CATEGORIES' && selectedCategory === 'ALL' && !searchQuery.trim() ? (
            /* Smart Category Folders / Sections View */
            <ScrollView contentContainerStyle={styles.categoriesScroll}>
              <Text style={styles.longPressHint}>💡 Tip: Long press any app to Pin to Home Dock, Hide, or view Info</Text>
              {categoryGroups.map((group) => (
                <View key={group.category.key} style={styles.categoryFolderCard}>
                  <View style={styles.categoryFolderHeader}>
                    <View style={styles.categoryTitleRow}>
                      <Text style={styles.categoryEmoji}>{group.category.emoji}</Text>
                      <Text style={styles.categoryTitle}>{group.category.label}</Text>
                    </View>
                    <View style={styles.categoryCountBadge}>
                      <Text style={styles.categoryCountText}>{group.apps.length} APPS</Text>
                    </View>
                  </View>
                  <View style={styles.categoryAppsGrid}>
                    {group.apps.map((item) => (
                      <TouchableOpacity
                        key={item.packageName}
                        style={styles.categoryAppItem}
                        onPress={() => SystemControlModule.launchApp(item.packageName)}
                        onLongPress={() => setSelectedAppForAction(item)}
                        activeOpacity={0.7}
                      >
                        {item.icon ? (
                          <Image source={{ uri: item.icon }} style={styles.appIcon} />
                        ) : (
                          <View style={styles.appIconFallback}>
                            <Text style={styles.appIconFallbackText}>{item.appName.charAt(0)}</Text>
                          </View>
                        )}
                        <Text numberOfLines={1} style={styles.appNameText}>
                          {item.appName}
                        </Text>
                        {pinnedPackages.includes(item.packageName) && (
                          <View style={styles.pinnedMarker}>
                            <Text style={styles.pinnedMarkerText}>⭐</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            /* Flattened Grid View for filtered/searched apps */
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item.packageName}
              numColumns={4}
              contentContainerStyle={styles.appsGrid}
              ListHeaderComponent={
                <Text style={styles.longPressHint}>
                  Showing {filteredApps.length} apps • Long press to manage
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.appGridItem}
                  onPress={() => SystemControlModule.launchApp(item.packageName)}
                  onLongPress={() => setSelectedAppForAction(item)}
                  activeOpacity={0.7}
                >
                  {item.icon ? (
                    <Image source={{ uri: item.icon }} style={styles.appIcon} />
                  ) : (
                    <View style={styles.appIconFallback}>
                      <Text style={styles.appIconFallbackText}>{item.appName.charAt(0)}</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.appNameText}>
                    {item.appName}
                  </Text>
                  {pinnedPackages.includes(item.packageName) && (
                    <View style={styles.pinnedMarker}>
                      <Text style={styles.pinnedMarkerText}>⭐</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Tab 3: DEVICE SYSTEM CONTROLS */}
      {activeTab === 'CONTROL' && (
        <ScrollView contentContainerStyle={styles.controlContent}>
          <Text style={styles.controlHeader}>SYSTEM CONTROLS & GESTURES</Text>

          <View style={styles.controlGrid}>
            <TouchableOpacity
              style={styles.controlCard}
              onPress={() => AccessibilityModule.performGlobalAction('TAKE_SCREENSHOT')}
            >
              <Text style={styles.controlCardEmoji}>📸</Text>
              <Text style={styles.controlCardTitle}>Screenshot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlCard, torchOn && styles.controlCardActive]}
              onPress={toggleTorch}
            >
              <Text style={styles.controlCardEmoji}>🔦</Text>
              <Text style={styles.controlCardTitle}>Torch {torchOn ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlCard}
              onPress={() => AccessibilityModule.performGlobalAction('NOTIFICATIONS')}
            >
              <Text style={styles.controlCardEmoji}>🔔</Text>
              <Text style={styles.controlCardTitle}>Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlCard}
              onPress={() => AccessibilityModule.performGlobalAction('QUICK_SETTINGS')}
            >
              <Text style={styles.controlCardEmoji}>⚙️</Text>
              <Text style={styles.controlCardTitle}>Quick Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlCard}
              onPress={() => AccessibilityModule.performGlobalAction('RECENTS')}
            >
              <Text style={styles.controlCardEmoji}>🔲</Text>
              <Text style={styles.controlCardTitle}>Recents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlCard}
              onPress={() => AccessibilityModule.performGlobalAction('BACK')}
            >
              <Text style={styles.controlCardEmoji}>◀️</Text>
              <Text style={styles.controlCardTitle}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlCard, isAssistantEnabled ? styles.controlCardActive : styles.controlCardDanger]}
              onPress={async () => {
                await VoicePipeline.toggleAssistant();
              }}
            >
              <Text style={styles.controlCardEmoji}>{isAssistantEnabled ? '⚡' : '🛑'}</Text>
              <Text style={styles.controlCardTitle}>
                {isAssistantEnabled ? 'Mute FRIDAY' : 'Power On FRIDAY'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlCard, styles.controlCardExit]}
              onPress={() => SystemControlModule.exitApplication()}
            >
              <Text style={styles.controlCardEmoji}>⏻</Text>
              <Text style={[styles.controlCardTitle, styles.textRed]}>Exit App</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.volumeCard}>
            <Text style={styles.volumeCardTitle}>VOLUME CONTROLS</Text>
            <View style={styles.volumeRow}>
              <TouchableOpacity
                style={styles.volumeBtn}
                onPress={() => SystemControlModule.setVolume('MEDIA', 30)}
              >
                <Text style={styles.volumeBtnText}>30%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.volumeBtn}
                onPress={() => SystemControlModule.setVolume('MEDIA', 70)}
              >
                <Text style={styles.volumeBtnText}>70%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.volumeBtn}
                onPress={() => SystemControlModule.setVolume('MEDIA', 100)}
              >
                <Text style={styles.volumeBtnText}>100%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.volumeBtn}
                onPress={() => SystemControlModule.setVolume('MEDIA', 0)}
              >
                <Text style={styles.volumeBtnText}>MUTE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      <UpdateModal />
      <AppActionModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(10, 18, 30, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  hudTime: {
    color: Colors.hudCyan,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  hudDate: {
    color: Colors.textDim,
    fontSize: 12,
  },
  hudStats: {
    alignItems: 'flex-end',
  },
  statText: {
    color: Colors.hudGreen,
    fontSize: 12,
    fontWeight: 'bold',
  },
  statTextDim: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    gap: 8,
  },
  badgeBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(0, 255, 157, 0.12)',
    borderWidth: 1,
    borderColor: Colors.hudGreen,
  },
  badgeActionNeeded: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: Colors.hudCyan,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hudCyanDim,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    paddingVertical: 8,
  },
  searchExecuteBtn: {
    backgroundColor: Colors.hudCyan,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  searchExecuteText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.hudCyan,
  },
  tabText: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: Colors.hudCyan,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  transcriptBox: {
    backgroundColor: Colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hudCyanDim,
    marginVertical: 8,
  },
  transcriptLabel: {
    color: Colors.hudCyan,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transcriptText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  goalBox: {
    backgroundColor: Colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
  },
  goalLabel: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  goalText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  streamSection: {
    marginVertical: 12,
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  responseBox: {
    backgroundColor: Colors.cardBackground,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hudGreen,
    marginTop: 12,
  },
  responseLabel: {
    color: Colors.hudGreen,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  responseText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  quickDockSection: {
    marginTop: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
  },
  dockTitle: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  dockRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dockItem: {
    alignItems: 'center',
    width: 60,
  },
  dockIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  dockIconFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.hudCyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockIconText: {
    color: Colors.hudCyan,
    fontSize: 18,
    fontWeight: 'bold',
  },
  dockLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  appsContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  appsGrid: {
    paddingVertical: 12,
  },
  appGridItem: {
    flex: 1 / 4,
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 4,
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
  },
  appIconFallbackText: {
    color: Colors.hudCyan,
    fontSize: 20,
    fontWeight: 'bold',
  },
  appNameText: {
    color: Colors.textPrimary,
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  controlContent: {
    padding: 16,
  },
  controlHeader: {
    color: Colors.hudCyan,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  controlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  controlCard: {
    width: '47%',
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  controlCardActive: {
    borderColor: Colors.hudCyan,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  controlCardDanger: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  controlCardExit: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  controlCardEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  controlCardTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  masterPowerBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  masterPowerActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderColor: Colors.hudCyan,
    shadowColor: Colors.hudCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  masterPowerDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  masterPowerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  masterPowerIndicator: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderWidth: 1,
    borderColor: Colors.hudCyan,
  },
  indicatorDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  masterPowerIcon: {
    fontSize: 20,
  },
  masterPowerTextCol: {
    flex: 1,
  },
  masterPowerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masterPowerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  masterPowerSub: {
    color: Colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowRadius: 4,
    shadowOpacity: 1,
  },
  dotRed: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowRadius: 4,
    shadowOpacity: 1,
  },
  textGreen: {
    color: Colors.hudCyan,
  },
  textRed: {
    color: '#ef4444',
  },
  iconGreen: {
    color: Colors.hudCyan,
  },
  iconRed: {
    color: '#ef4444',
  },
  updateBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: Colors.hudCyan,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  updateBannerIcon: {
    fontSize: 22,
  },
  updateBannerTextCol: {
    flex: 1,
  },
  updateBannerTitle: {
    color: Colors.hudCyan,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  updateBannerSub: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  updateBannerAction: {
    color: '#000',
    backgroundColor: Colors.hudCyan,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  volumeCard: {
    marginTop: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  volumeCardTitle: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  volumeBtn: {
    backgroundColor: Colors.hudCyanDim,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hudCyan,
  },
  volumeBtnText: {
    color: Colors.hudCyan,
    fontSize: 11,
    fontWeight: 'bold',
  },
  dockHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dockManageText: {
    color: Colors.hudCyan,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  dockScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  filterBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.hudCyanDim,
    borderColor: Colors.hudCyan,
  },
  filterChipText: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterChipTextActive: {
    color: Colors.hudCyan,
  },
  layoutToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  layoutToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  layoutToggleBtnActive: {
    backgroundColor: Colors.hudCyanDim,
    borderColor: Colors.hudCyan,
  },
  layoutToggleText: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  layoutToggleTextActive: {
    color: Colors.hudCyan,
  },
  categoriesScroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  longPressHint: {
    color: Colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  categoryFolderCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
  },
  categoryFolderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  categoryCountBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  categoryCountText: {
    color: Colors.hudCyan,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  categoryAppsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  categoryAppItem: {
    width: '25%',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
  },
  pinnedMarker: {
    position: 'absolute',
    top: 2,
    right: 8,
  },
  pinnedMarkerText: {
    fontSize: 10,
  },
});
