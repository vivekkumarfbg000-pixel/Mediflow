/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║       VITALSYNC MEDIFLOW — MILITARY-GRADE IOT DEVICE DRIVER LAYER        ║
 * ║  PHASE 21: Hardware & IoT Ambient Sync (Zero-Data-Entry Doctrine)         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Implements native Web Bluetooth API (GATT IEEE-11073) and WebSerial API
 * drivers for clinical peripherals:
 * 1. Digital Blood Pressure Monitors (Service: 0x1810, Char: 0x2A35)
 * 2. Pulse Oximeters (Service: 0x1822, Char: 0x2A5F / 0x2A5E)
 * 3. Digital Glucometers (Service: 0x1808, Char: 0x2A18)
 * 4. Smart Digital Weighing Scales (Service: 0x181D, Char: 0x2A9D)
 * 5. Multi-parameter Monitor WebSerial ASCII Stream Reader
 * 6. Autonomous Hardware Simulation Engine for Zero-Hardware Testing
 */

import type { IoTDeviceReading, IoTDeviceType, IoTConnectionStatus, PatientVitals } from '../types';

// GATT Standard Bluetooth SIG Assigned Numbers
export const BLE_SERVICES = {
  BLOOD_PRESSURE: 0x1810,
  PULSE_OXIMETER: 0x1822,
  GLUCOSE: 0x1808,
  WEIGHT_SCALE: 0x181D,
  HEALTH_THERMOMETER: 0x1809
} as const;

export const BLE_CHARACTERISTICS = {
  BP_MEASUREMENT: 0x2A35,
  PULSE_OX_SPOT: 0x2A5F,
  PULSE_OX_CONT: 0x2A5E,
  GLUCOSE_MEASUREMENT: 0x2A18,
  WEIGHT_MEASUREMENT: 0x2A9D,
  TEMPERATURE_MEASUREMENT: 0x2A1C
} as const;

export class IoTDeviceService {
  private static listeners: Set<(reading: IoTDeviceReading) => void> = new Set();
  private static statusListeners: Set<(deviceType: IoTDeviceType, status: IoTConnectionStatus) => void> = new Set();
  private static activeConnections: Map<IoTDeviceType, any> = new Map();

  /**
   * Checks if the Web Bluetooth API is supported by the current browser.
   */
  static isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Checks if the WebSerial API is supported by the current browser.
   */
  static isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * IEEE-11073 16-bit SFLOAT decoder (Used across Bluetooth SIG medical profiles)
   */
  static readSFloat(dataView: DataView, offset: number): number {
    const raw = dataView.getUint16(offset, true);
    let mantissa = raw & 0x0FFF;
    let exponent = (raw >> 12) & 0x000F;

    // Sign extension for 12-bit mantissa
    if (mantissa >= 0x0800) {
      mantissa -= 0x1000;
    }
    // Sign extension for 4-bit exponent
    if (exponent >= 0x08) {
      exponent -= 0x10;
    }

    return mantissa * Math.pow(10, exponent);
  }

  /**
   * Blood Pressure GATT Measurement Decoder (Characteristic 0x2A35)
   */
  static parseBloodPressureData(dataView: DataView): Partial<PatientVitals> {
    if (dataView.byteLength < 7) {
      throw new Error(`Invalid Blood Pressure GATT packet: expected >= 7 bytes, got ${dataView.byteLength}`);
    }

    const flags = dataView.getUint8(0);
    const isKpa = (flags & 0x01) !== 0;
    const hasTimestamp = (flags & 0x02) !== 0;
    const hasPulseRate = (flags & 0x04) !== 0;

    let sysRaw = this.readSFloat(dataView, 1);
    let diaRaw = this.readSFloat(dataView, 3);

    // Convert kPa to mmHg if unit bit is set (1 kPa = 7.50062 mmHg)
    if (isKpa) {
      sysRaw = Math.round(sysRaw * 7.50062);
      diaRaw = Math.round(diaRaw * 7.50062);
    } else {
      sysRaw = Math.round(sysRaw);
      diaRaw = Math.round(diaRaw);
    }

    let pulseRate: string | undefined = undefined;
    let offset = 7; // flags (1) + sys (2) + dia (2) + map (2)
    if (hasTimestamp) offset += 7; // Year(2), Month(1), Day(1), Hour(1), Min(1), Sec(1)

    if (hasPulseRate && dataView.byteLength >= offset + 2) {
      const pulseRaw = Math.round(this.readSFloat(dataView, offset));
      if (pulseRaw > 20 && pulseRaw < 250) {
        pulseRate = String(pulseRaw);
      }
    }

    return {
      bloodPressure: `${sysRaw}/${diaRaw}`,
      ...(pulseRate ? { pulseRate } : {}),
      deviceSource: 'bluetooth',
      recordedAt: new Date().toISOString()
    };
  }

  /**
   * Pulse Oximeter GATT Measurement Decoder (Characteristics 0x2A5F / 0x2A5E)
   */
  static parsePulseOximeterData(dataView: DataView): Partial<PatientVitals> {
    if (dataView.byteLength < 4) {
      throw new Error(`Invalid Pulse Oximeter GATT packet: expected >= 4 bytes, got ${dataView.byteLength}`);
    }

    const flags = dataView.getUint8(0);
    let spO2Raw: number;
    let pulseRateRaw: number;

    // Check if Spot-Check or Continuous format
    if (dataView.byteLength >= 5) {
      spO2Raw = Math.round(this.readSFloat(dataView, 1));
      pulseRateRaw = Math.round(this.readSFloat(dataView, 3));
    } else {
      spO2Raw = dataView.getUint8(1);
      pulseRateRaw = dataView.getUint8(2);
    }

    // Clamp to biological sanity ranges
    const spO2 = Math.min(100, Math.max(50, spO2Raw));
    const pulseRate = Math.min(240, Math.max(30, pulseRateRaw));

    return {
      spO2: String(spO2),
      pulseRate: String(pulseRate),
      deviceSource: 'bluetooth',
      recordedAt: new Date().toISOString()
    };
  }

  /**
   * Glucose GATT Measurement Decoder (Characteristic 0x2A18)
   */
  static parseGlucoseData(dataView: DataView): Partial<PatientVitals> {
    if (dataView.byteLength < 10) {
      throw new Error(`Invalid Glucose GATT packet: expected >= 10 bytes, got ${dataView.byteLength}`);
    }

    const flags = dataView.getUint8(0);
    const isMolL = (flags & 0x01) !== 0;
    const hasTimeOffset = (flags & 0x02) !== 0;

    let offset = 1 + 2 + 7; // flags (1) + seqNum (2) + baseTime (7)
    if (hasTimeOffset) offset += 2;

    if (dataView.byteLength < offset + 2) {
      throw new Error(`Glucose packet truncated before concentration field`);
    }

    let concentration = this.readSFloat(dataView, offset);

    // If unit is mol/L, concentration is in kg/L or mol/L. Standard blood glucose converts to mg/dL:
    // 1 mmol/L = 18.0182 mg/dL.
    if (isMolL) {
      concentration = Math.round(concentration * 1000 * 18.0182); // mol/L -> mmol/L -> mg/dL
    } else {
      // In kg/L (Bluetooth SIG spec: kg/L * 100,000 = mg/dL)
      concentration = Math.round(concentration * 100000);
    }

    if (concentration <= 0 || concentration > 1000) {
      // Fallback direct reading if vendor pre-scales to mg/dL
      concentration = Math.round(this.readSFloat(dataView, offset));
    }

    return {
      bloodSugar: String(concentration),
      bloodSugarContext: 'random',
      deviceSource: 'bluetooth',
      recordedAt: new Date().toISOString()
    };
  }

  /**
   * Weight Scale GATT Measurement Decoder (Characteristic 0x2A9D)
   */
  static parseWeightScaleData(dataView: DataView): Partial<PatientVitals> {
    if (dataView.byteLength < 3) {
      throw new Error(`Invalid Weight Scale GATT packet: expected >= 3 bytes, got ${dataView.byteLength}`);
    }

    const flags = dataView.getUint8(0);
    const isImperial = (flags & 0x01) !== 0; // 0 = SI (kg), 1 = Imperial (lbs)
    const rawVal = dataView.getUint16(1, true);

    let weightKg: number;
    if (isImperial) {
      // 0.01 lb resolution
      const weightLbs = rawVal * 0.01;
      weightKg = Number((weightLbs * 0.45359237).toFixed(1));
    } else {
      // 0.005 kg resolution (or 0.1 depending on scale)
      const res = rawVal > 10000 ? 0.005 : 0.1;
      weightKg = Number((rawVal * res).toFixed(1));
    }

    return {
      weight: String(weightKg),
      deviceSource: 'bluetooth',
      recordedAt: new Date().toISOString()
    };
  }

  /**
   * Multi-parameter Monitor WebSerial ASCII Stream Parser
   * Parses standard NMEA/ASCII packet formats: e.g. "BP:120/80,HR:72,SPO2:98,TEMP:98.4,WT:65"
   */
  static parseSerialAsciiPacket(rawString: string): Partial<PatientVitals> {
    const text = String(rawString || '').trim();
    const vitals: Partial<PatientVitals> = {
      deviceSource: 'serial',
      recordedAt: new Date().toISOString()
    };

    // Extract BP
    const bpMatch = text.match(/(?:BP|NIBP)[:= ]*([0-9]{2,3})\s*[/,\-]\s*([0-9]{2,3})/i);
    if (bpMatch) {
      vitals.bloodPressure = `${bpMatch[1]}/${bpMatch[2]}`;
    }

    // Extract Pulse / Heart Rate
    const pulseMatch = text.match(/(?:HR|PR|PULSE)[:= ]*([0-9]{2,3})/i);
    if (pulseMatch) {
      vitals.pulseRate = pulseMatch[1];
    }

    // Extract SpO2
    const spo2Match = text.match(/(?:SPO2|O2|SAT)[:= ]*([0-9]{2,3})/i);
    if (spo2Match) {
      vitals.spO2 = spo2Match[1];
    }

    // Extract Temp
    const tempMatch = text.match(/(?:TEMP|T)[:= ]*([0-9]{2,3}(?:\.[0-9]+)?)/i);
    if (tempMatch) {
      vitals.temperature = tempMatch[1];
    }

    // Extract Weight
    const wtMatch = text.match(/(?:WT|WEIGHT)[:= ]*([0-9]{2,3}(?:\.[0-9]+)?)/i);
    if (wtMatch) {
      vitals.weight = wtMatch[1];
    }

    // Extract Glucose
    const gluMatch = text.match(/(?:GLU|SUGAR)[:= ]*([0-9]{2,3})/i);
    if (gluMatch) {
      vitals.bloodSugar = gluMatch[1];
    }

    return vitals;
  }

  /**
   * Connect to a physical Bluetooth peripheral using Web Bluetooth API
   */
  static async connectBluetoothDevice(deviceType: IoTDeviceType): Promise<IoTDeviceReading> {
    if (!this.isBluetoothSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser. Please use Chrome, Edge, or use Simulated Mode.');
    }

    this.notifyStatus(deviceType, 'connecting');

    try {
      let serviceUuid: number;
      let charUuid: number;
      let parser: (dv: DataView) => Partial<PatientVitals>;

      switch (deviceType) {
        case 'blood_pressure':
          serviceUuid = BLE_SERVICES.BLOOD_PRESSURE;
          charUuid = BLE_CHARACTERISTICS.BP_MEASUREMENT;
          parser = this.parseBloodPressureData.bind(this);
          break;
        case 'pulse_oximeter':
          serviceUuid = BLE_SERVICES.PULSE_OXIMETER;
          charUuid = BLE_CHARACTERISTICS.PULSE_OX_SPOT;
          parser = this.parsePulseOximeterData.bind(this);
          break;
        case 'glucometer':
          serviceUuid = BLE_SERVICES.GLUCOSE;
          charUuid = BLE_CHARACTERISTICS.GLUCOSE_MEASUREMENT;
          parser = this.parseGlucoseData.bind(this);
          break;
        case 'weight_scale':
          serviceUuid = BLE_SERVICES.WEIGHT_SCALE;
          charUuid = BLE_CHARACTERISTICS.WEIGHT_MEASUREMENT;
          parser = this.parseWeightScaleData.bind(this);
          break;
        default:
          throw new Error(`Unsupported BLE device type: ${deviceType}`);
      }

      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        filters: [{ services: [serviceUuid] }],
        optionalServices: ['battery_service']
      });

      const server = await device.gatt.connect();
      this.activeConnections.set(deviceType, server);
      this.notifyStatus(deviceType, 'connected');

      const service = await server.getPrimaryService(serviceUuid);
      const characteristic = await service.getCharacteristic(charUuid);

      // Start notifications or read value
      await characteristic.startNotifications();
      this.notifyStatus(deviceType, 'streaming');

      return new Promise<IoTDeviceReading>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout awaiting GATT reading from ${device.name || deviceType}`));
        }, 30000);

        characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          clearTimeout(timeout);
          const dataView: DataView = event.target.value;
          const parsed = parser(dataView);

          const reading: IoTDeviceReading = {
            deviceType,
            deviceName: device.name || `${deviceType} BLE Peripheral`,
            timestamp: new Date().toISOString(),
            rawBufferHex: Array.from(new Uint8Array(dataView.buffer))
              .map(b => b.toString(16).padStart(2, '0'))
              .join(' '),
            vitals: parsed,
            confidenceScore: 98
          };

          IoTDeviceService.notifyReading(reading);
          resolve(reading);
        });
      });
    } catch (err: any) {
      this.notifyStatus(deviceType, 'error');
      throw err;
    }
  }

  /**
   * Connect to an external serial multiplex monitor via WebSerial API
   */
  static async connectSerialMonitor(): Promise<void> {
    if (!this.isSerialSupported()) {
      throw new Error('WebSerial API is not supported in this browser. Please use Chrome or Edge.');
    }

    this.notifyStatus('multipara_serial', 'connecting');

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      this.notifyStatus('multipara_serial', 'connected');

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      this.notifyStatus('multipara_serial', 'streaming');

      let accumulated = '';
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              accumulated += value;
              const lines = accumulated.split(/[\r\n]+/);
              accumulated = lines.pop() || '';
              for (const line of lines) {
                if (line.trim().length > 0) {
                  const parsed = this.parseSerialAsciiPacket(line);
                  if (Object.keys(parsed).length > 2) {
                    const reading: IoTDeviceReading = {
                      deviceType: 'multipara_serial',
                      deviceName: 'Multipara Bedside Monitor (Serial)',
                      timestamp: new Date().toISOString(),
                      vitals: parsed,
                      confidenceScore: 99
                    };
                    IoTDeviceService.notifyReading(reading);
                  }
                }
              }
            }
          }
        } catch (_readErr) {
          this.notifyStatus('multipara_serial', 'error');
        }
      })();
    } catch (err: any) {
      this.notifyStatus('multipara_serial', 'error');
      throw err;
    }
  }

  /**
   * Autonomous Hardware Simulator Mode (Clinical Demonstration & Unit Testing)
   */
  static simulateReading(deviceType: IoTDeviceType): IoTDeviceReading {
    let vitals: Partial<PatientVitals> = {
      deviceSource: 'simulated',
      recordedAt: new Date().toISOString()
    };

    switch (deviceType) {
      case 'blood_pressure': {
        const sys = Math.floor(Math.random() * 20) + 115; // 115 - 134
        const dia = Math.floor(Math.random() * 14) + 74;  // 74 - 87
        const pulse = Math.floor(Math.random() * 16) + 68; // 68 - 83
        vitals.bloodPressure = `${sys}/${dia}`;
        vitals.pulseRate = String(pulse);
        break;
      }
      case 'pulse_oximeter': {
        const spo2 = Math.floor(Math.random() * 3) + 97; // 97 - 99%
        const pulse = Math.floor(Math.random() * 12) + 70; // 70 - 81 bpm
        vitals.spO2 = String(spo2);
        vitals.pulseRate = String(pulse);
        break;
      }
      case 'glucometer': {
        const glucose = Math.floor(Math.random() * 40) + 95; // 95 - 134 mg/dL
        vitals.bloodSugar = String(glucose);
        vitals.bloodSugarContext = 'random';
        break;
      }
      case 'weight_scale': {
        const weight = Number((Math.random() * 15 + 62).toFixed(1)); // 62.0 - 76.9 kg
        vitals.weight = String(weight);
        break;
      }
      case 'multipara_serial': {
        vitals.bloodPressure = '122/78';
        vitals.pulseRate = '74';
        vitals.spO2 = '98';
        vitals.temperature = '98.4';
        vitals.weight = '68.0';
        vitals.bloodSugar = '102';
        break;
      }
    }

    const reading: IoTDeviceReading = {
      deviceType,
      deviceName: `Simulated Clinical ${deviceType.replace('_', ' ').toUpperCase()} (IoT)`,
      timestamp: new Date().toISOString(),
      rawBufferHex: '00 76 00 4e 00 52 00',
      vitals,
      confidenceScore: 100
    };

    this.notifyReading(reading);
    return reading;
  }

  /**
   * Subscribe to ambient IoT device reading stream
   */
  static subscribe(listener: (reading: IoTDeviceReading) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to device connection status changes
   */
  static onStatusChange(listener: (deviceType: IoTDeviceType, status: IoTConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private static notifyReading(reading: IoTDeviceReading) {
    this.listeners.forEach(fn => {
      try { fn(reading); } catch (_e) {}
    });
  }

  private static notifyStatus(deviceType: IoTDeviceType, status: IoTConnectionStatus) {
    this.statusListeners.forEach(fn => {
      try { fn(deviceType, status); } catch (_e) {}
    });
  }
}
