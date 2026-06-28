import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform
} from 'react-native';
import { 
  Home, 
  Camera, 
  Bell, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Search, 
  Database, 
  Cpu, 
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react-native';

export default function AppIndex() {
  const [activeTab, setActiveTab] = useState<'home' | 'ocr' | 'alerts' | 'logs'>('home');
  const [cameraActive, setCameraActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    'System: Mobile node registered successfully.',
    'SQLite: Synced 12 local cache profiles.',
    'APNS: Remote Apple/Google push channels live.',
    'Sync: Offline database aligned with pg_public.'
  ]);
  const [notifications, setNotifications] = useState<string[]>([
    'Vitals alert: HbA1c threshold exceeded for Rahul Kumar (7.8%)',
    'Sync completed: Prescriptions updated for Patna Pod 04',
    'Access control: New device verified for Dr. Vivek'
  ]);

  const activityData = [
    { day: 'M', count: 18, height: 40 },
    { day: 'T', count: 24, height: 60 },
    { day: 'W', count: 32, height: 80 },
    { day: 'T', count: 15, height: 35 },
    { day: 'F', count: 45, height: 100 },
    { day: 'S', count: 28, height: 70 },
    { day: 'S', count: 10, height: 25 },
  ];

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length === 0) {
      setSearchError(null);
      setSearchSuccess(false);
    } else if (/^\d+$/.test(text)) {
      if (text.length === 10) {
        setSearchError(null);
        setSearchSuccess(true);
      } else {
        setSearchError('Phone must be 10 digits');
        setSearchSuccess(false);
      }
    } else if (text.length < 3) {
      setSearchError('Name must be at least 3 letters');
      setSearchSuccess(false);
    } else {
      setSearchError(null);
      setSearchSuccess(true);
    }
  };

  const triggerMockOCR = () => {
    setCameraActive(true);
    setTimeout(() => {
      setCameraActive(false);
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Snapped Rx prescription image.`,
        `[${timestamp}] OCR Parsed: Rahul Kumar (35y) - Metformin 500mg.`
      ]);
      setNotifications(prev => [
        `OCR success: Metformin prescription registered for Rahul Kumar`,
        ...prev
      ]);
      setActiveTab('home');
    }, 2500);
  };

  const triggerLocalAlert = () => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [
      ...prev,
      `[${timestamp}] Vitals alarm simulated.`
    ]);
    setNotifications(prev => [
      `Critical alert: HbA1c result of 7.8% verified for patient Rahul Kumar`,
      ...prev
    ]);
  };

  const clearNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Block */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>OFFLINE-FIRST CLINICAL COMPANION</Text>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Mediflow Care Dashboard</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.onlineText}>SYNCED</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher Body */}
        {activeTab === 'home' && (
          <View style={styles.tabContainer}>
            {/* SaaS Metrics Row */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Database size={16} color="#818cf8" />
                <Text style={styles.metricVal}>12</Text>
                <Text style={styles.metricLabel}>Local Profiles</Text>
              </View>
              <View style={styles.metricCard}>
                <Activity size={16} color="#10b981" />
                <Text style={styles.metricVal}>100%</Text>
                <Text style={styles.metricLabel}>Sync Health</Text>
              </View>
              <View style={styles.metricCard}>
                <TrendingUp size={16} color="#f59e0b" />
                <Text style={styles.metricVal}>45</Text>
                <Text style={styles.metricLabel}>Weekly Scans</Text>
              </View>
            </View>

            {/* Premium Custom Chart Widget */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Activity size={16} color="#818cf8" />
                <Text style={styles.cardTitle}>Ecosystem Scan Traffic</Text>
              </View>
              <Text style={styles.cardDesc}>
                Weekly volume of OCR prescription processing and CDSS consultation matches.
              </Text>
              <View style={styles.chartWrapper}>
                {activityData.map((data, i) => (
                  <View key={i} style={styles.chartCol}>
                    <View style={styles.chartBarTrack}>
                      <View style={[styles.chartBar, { height: `${data.height}%` }]} />
                    </View>
                    <Text style={styles.chartLabel}>{data.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Premium Input & Real-Time Validation Widget */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔍 Quick Patient Registry Lookup</Text>
              <Text style={styles.cardDesc}>
                Enter patient phone number or registration name for instant local SQLite query lookup.
              </Text>
              <View style={[
                styles.inputWrapper,
                searchError ? styles.inputWrapperError : null,
                searchSuccess ? styles.inputWrapperSuccess : null
              ]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 9876543210 or Rahul"
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  autoCapitalize="none"
                />
                {searchSuccess && <CheckCircle2 size={16} color="#10b981" style={styles.inputIcon} />}
                {searchError && <AlertCircle size={16} color="#ef4444" style={styles.inputIcon} />}
              </View>
              {searchError && <Text style={styles.validationError}>{searchError}</Text>}
              {searchSuccess && (
                <View style={styles.validationSuccessBox}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <Text style={styles.validationSuccessText}>Patient match found in offline DB cache</Text>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚡ Operator Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveTab('ocr')}>
                  <Camera size={18} color="#818cf8" />
                  <Text style={styles.actionBtnText}>Launch OCR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={triggerLocalAlert}>
                  <Bell size={18} color="#f59e0b" />
                  <Text style={styles.actionBtnText}>Simulate Alarm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'ocr' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📷 Camera e-Rx OCR Bridge</Text>
              <Text style={styles.cardDesc}>
                Snap a clear picture of physical prescription documents to run automatic FastAPI RAG parsing.
              </Text>
              
              {cameraActive ? (
                <View style={styles.cameraBox}>
                  <RefreshCw size={24} color="#f87171" style={styles.spinIcon} />
                  <Text style={styles.cameraText}>⚡ AI SCANNER PROCESSING ⚡</Text>
                  <Text style={styles.cameraSubtext}>Analyzing margins and text blocks...</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.buttonPrimary} onPress={triggerMockOCR}>
                  <Text style={styles.buttonText}>Snap Prescription Document</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {activeTab === 'alerts' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔔 Push Notification Spool</Text>
              <Text style={styles.cardDesc}>
                Supabase CDC database webhooks push critical alerts directly to your clinical nodes.
              </Text>
              
              <TouchableOpacity style={styles.buttonSecondary} onPress={triggerLocalAlert}>
                <Text style={styles.buttonTextSecondary}>Simulate Vitals Alarm</Text>
              </TouchableOpacity>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle2 size={24} color="#10b981" />
                <Text style={styles.emptyStateText}>No pending alerts</Text>
              </View>
            ) : (
              <View style={styles.alertsList}>
                {notifications.map((notif, index) => (
                  <View key={index} style={styles.alertCard}>
                    <View style={styles.alertHeader}>
                      <View style={styles.alertIndicator} />
                      <Text style={styles.alertText}>{notif}</Text>
                    </View>
                    <TouchableOpacity onPress={() => clearNotification(index)}>
                      <Text style={styles.clearBtnText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'logs' && (
          <View style={styles.tabContainer}>
            <View style={styles.consoleCard}>
              <View style={styles.cardHeader}>
                <Terminal size={14} color="#818cf8" />
                <Text style={styles.consoleTitle}>Mobile Svc Node Developer Logs</Text>
              </View>
              <ScrollView style={styles.logsScroll} nestedScrollEnabled={true}>
                <View style={styles.logsBox}>
                  {logs.map((log, index) => (
                    <Text key={index} style={styles.logText}>👉 {log}</Text>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Premium Glassmorphic Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'home' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('home')}
        >
          <Home size={18} color={activeTab === 'home' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.navText, activeTab === 'home' ? styles.navTextActive : null]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'ocr' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('ocr')}
        >
          <Camera size={18} color={activeTab === 'ocr' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.navText, activeTab === 'ocr' ? styles.navTextActive : null]}>OCR</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'alerts' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('alerts')}
        >
          <Bell size={18} color={activeTab === 'alerts' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.navText, activeTab === 'alerts' ? styles.navTextActive : null]}>Alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'logs' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('logs')}
        >
          <Terminal size={18} color={activeTab === 'logs' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.navText, activeTab === 'logs' ? styles.navTextActive : null]}>Logs</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
    gap: 16,
  },
  header: {
    marginBottom: 8,
    marginTop: Platform.OS === 'ios' ? 0 : 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  subtitle: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  onlineText: {
    color: '#10b981',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  tabContainer: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  metricVal: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  chartWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  chartCol: {
    alignItems: 'center',
    width: '12%',
  },
  chartBarTrack: {
    height: 90,
    width: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#818cf8',
    borderRadius: 4,
  },
  chartLabel: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 6,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  inputWrapperSuccess: {
    borderColor: '#10b981',
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
  },
  inputIcon: {
    marginLeft: 8,
  },
  validationError: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  validationSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  validationSuccessText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  buttonPrimary: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  buttonTextSecondary: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  cameraBox: {
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  spinIcon: {
    marginVertical: 4,
  },
  cameraText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cameraSubtext: {
    color: '#64748b',
    fontSize: 9,
  },
  emptyState: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertsList: {
    gap: 10,
  },
  alertCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  alertIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  alertText: {
    color: '#e2e8f0',
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
  clearBtnText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  consoleCard: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  consoleTitle: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logsScroll: {
    maxHeight: 300,
  },
  logsBox: {
    gap: 6,
  },
  logText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 14,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 12 : 0,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 16,
    gap: 4,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#6366f1',
  },
  navText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold',
  },
  navTextActive: {
    color: '#6366f1',
  }
});
