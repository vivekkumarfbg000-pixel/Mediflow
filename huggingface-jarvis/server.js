const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// 1. Configuration
const app = express();
const port = process.env.PORT || 7860; // 7860 is Hugging Face Spaces default port

app.use(cors());
app.use(express.json());

// Init Supabase (You must set these in Hugging Face Space Settings -> Variables and Secrets)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// PART 1: JARVIS COMMAND CENTER (Receives UI Crashes)
// ==========================================
app.post('/push-console-error', async (req, res) => {
    const { level, message, stack, url, timestamp } = req.body;
    console.log(`[Jarvis Cloud] 🚨 Crash Received from ${url}:`, message);

    try {
        // Write the crash to Supabase so Antigravity AI can read it when you open your laptop
        const { error } = await supabase
            .from('system_health_telemetry')
            .insert([{
                subsystem: 'frontend',
                severity: level === 'unhandledrejection' ? 'critical' : 'warning',
                error_code: message.substring(0, 50),
                error_stack: stack,
                status: 'unresolved',
                created_at: timestamp || new Date().toISOString()
            }]);

        if (error && error.code !== '42P01') { // Ignore if table doesn't exist yet
            console.error('[Jarvis Cloud] Failed to save telemetry to Supabase:', error.message);
        }
        
        res.json({ success: true, message: "Crash logged by Cloud Jarvis" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

// Default Health Check Route
app.get('/', (req, res) => {
    res.json({ status: "Cloud Jarvis & Auto-Healer Online 24/7 🟢" });
});

// ==========================================
// PART 2: THE AUTO-HEALER (Background Watchdog)
// ==========================================
function startAutoHealer() {
    console.log('[Auto-Healer] Background Watchdog started.');

    setInterval(async () => {
        // 1. Every 5 minutes: Check Database Health
        console.log('[Auto-Healer] Pinging database for schema drift...');
        const { data, error } = await supabase.from('clinic_sops').select('id').limit(1);
        if (error) {
            console.log(`[Auto-Healer] ⚠️ Database Warning: ${error.message}`);
        } else {
            console.log('[Auto-Healer] Database is healthy.');
        }

        // 2. You can add more backend autonomous checks here
        // (e.g. check for stuck WhatsApp messages in database and clear them)

    }, 5 * 60 * 1000); // 5 minutes
}


// Start Unified Server
app.listen(port, () => {
    console.log(`🧠 Jarvis Cloud Command Center running on port ${port}`);
    startAutoHealer();
});
