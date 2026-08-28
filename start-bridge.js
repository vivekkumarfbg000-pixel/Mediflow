const { spawn } = require('child_process');

// Start the dev server
const devServer = spawn('npm', ['run', 'dev'], {
  cwd: 'C:\\Users\\vivek\\OneDrive\\Desktop\\Mediflow ecosystem',
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

// Start the bridge
const bridge = spawn('node', ['C:\\Users\\vivek\\Downloads\\Promtguardextension\\devserver_bridge.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Pipe dev server output to bridge
devServer.stdout.on('data', (data) => {
  bridge.stdin.write(data);
});

devServer.stderr.on('data', (data) => {
  bridge.stdin.write(data);
});

devServer.on('close', (code) => {
  console.log('Dev server exited with code:', code);
  bridge.stdin.end();
});

bridge.stdout.on('data', (data) => {
  console.log('[Bridge stdout]:', data.toString());
});

bridge.stderr.on('data', (data) => {
  console.log('[Bridge stderr]:', data.toString());
});

bridge.on('error', (err) => {
  console.log('[Bridge error]:', err);
});

devServer.on('error', (err) => {
  console.log('[Dev server error]:', err);
});

bridge.on('close', (code) => {
  console.log('Bridge exited with code:', code);
});

console.log('Started dev server and bridge');