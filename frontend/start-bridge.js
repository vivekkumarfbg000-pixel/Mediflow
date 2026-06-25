import { spawn } from 'child_process';
import path from 'path';

console.log("🚀 Starting Vite Dev Server and Prompt Guard Bridge...");

// Spawn Vite
const vite = spawn('npm', ['run', 'dev'], { 
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'] 
});

// Spawn Bridge
const bridgePath = 'C:\\Users\\vivek\\Downloads\\Promtguardextension\\devserver_bridge.js';
const bridge = spawn('node', [bridgePath], { 
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'] 
});

// Pipe Vite output to Bridge input
vite.stdout.pipe(bridge.stdin);
vite.stderr.pipe(bridge.stdin);

// Also echo to terminal so the user can see what's happening
vite.stdout.on('data', (data) => process.stdout.write(data));
vite.stderr.on('data', (data) => process.stderr.write(data));

bridge.stdout.on('data', (data) => process.stdout.write(data));
bridge.stderr.on('data', (data) => process.stderr.write(data));

vite.on('close', (code) => {
    console.log(`Vite process exited with code ${code}`);
    bridge.kill();
});

bridge.on('close', (code) => {
    console.log(`Bridge process exited with code ${code}`);
    vite.kill();
});
