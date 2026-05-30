import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView
} from 'react-native';

export default function AppIndex() {
  const [cameraActive, setCameraActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    'System: Mobile node registered successfully.',
    'SQLite: Synced 12 local cache profiles.',
    'APNS: Remote Apple/Google push channels live.'
  ]);

  const triggerMockOCR = () => {
    setCameraActive(true);
    setTimeout(() => {
      setCameraActive(false);
      setLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Snapped Rx prescription image.`,
        `[${new Date().toLocaleTimeString()}] OCR Parsed: Rahul Kumar (35y) - Metformin 500mg.`
      ]);
    }, 2500);
  };

  const triggerLocalAlert = () => {
    setLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] PUSH ALERT: Critical HbA1c result of 7.8% approved for Rahul Kumar.`
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>OFFLINE-FIRST CLINICAL COMPANION</Text>
          <Text style={styles.title}>Mediflow Care Companion</Text>
        </View>

        {/* Camera OCR Bridge */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📷 Camera e-Rx OCR Bridge</Text>
          <Text style={styles.cardDesc}>
            Snap picture of physical prescriptions to run remote FastAPI RAG parsing, matching Patna live inventories instantly.
          </Text>
          
          {cameraActive ? (
            <View style={styles.cameraBox}>
              <Text style={styles.cameraText}>⚡ AI CAMERA ACTIVE - ALIGNING PRESCRIPTION ⚡</Text>
              <Text style={styles.cameraSubtext}>Scanning margins and handwriting borders...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.buttonPrimary} onPress={triggerMockOCR}>
              <Text style={styles.buttonText}>Snap Prescription Document</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Live Push Notifications */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔔 Push Notification Spool</Text>
          <Text style={styles.cardDesc}>
            Real-time critical health alarms. Supabase Database CDC webhook alert triggers are routed directly to patient/doctor handsets.
          </Text>
          <TouchableOpacity style={styles.buttonSecondary} onPress={triggerLocalAlert}>
            <Text style={styles.buttonTextSecondary}>Simulate Remote Vitals Alarm</Text>
          </TouchableOpacity>
        </View>

        {/* Offline Engine status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💾 SQLite CDC Caching Engine</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Local Cache Health:</Text>
            <Text style={styles.statusValueGreen}>ACTIVE [OK]</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Pending Sync Records:</Text>
            <Text style={styles.statusValue}>0 Entries</Text>
          </View>
        </View>

        {/* Event Logs console */}
        <View style={styles.consoleCard}>
          <Text style={styles.consoleTitle}>💻 Mobile Svc Node Logs</Text>
          <View style={styles.logsBox}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>👉 {log}</Text>
            ))}
          </View>
        </View>

      </ScrollView>
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
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'System',
    marginTop: 4,
  },
  subtitle: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
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
    gap: 4,
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 6,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusValueGreen: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  consoleCard: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  consoleTitle: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logsBox: {
    gap: 6,
  },
  logText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontFamily: 'System',
    lineHeight: 14,
  }
});
