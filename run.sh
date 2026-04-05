#!/bin/bash
echo "======================================"
echo "   🔍 Network Scanner Installer"
echo "======================================"
echo ""

cd "/home/seif/المستندات/مجلد بدون عنوان"

# Check if node exists
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    sudo apt update
    sudo apt install nodejs npm -y
fi

echo "✅ Node version: $(node --version)"
echo ""

# Create server
cat > server.js << 'ENDOFFILE'
const http = require('http');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;
const isLinux = os.platform() !== 'win32';

function getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const results = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                results.push({ name, ip: addr.address, mac: addr.mac || 'N/A', netmask: addr.netmask || 'N/A' });
            }
        }
    }
    return results;
}

function pingHost(ip) {
    return new Promise((resolve) => {
        const cmd = isLinux ? `ping -c 1 -W 1 ${ip}` : `ping -n 1 -w 500 ${ip}`;
        exec(cmd, { timeout: 2000 }, (error) => resolve({ ip, alive: !error }));
    });
}

function arpScan() {
    return new Promise((resolve) => {
        exec('arp -a', { timeout: 5000 }, (error, stdout) => {
            if (error) return resolve([]);
            const devices = [];
            for (const line of stdout.split('\n')) {
                let ip, mac;
                if (isLinux) {
                    const ipM = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
                    const macM = line.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
                    if (ipM && macM) { ip = ipM[1]; mac = macM[1].toUpperCase(); }
                } else {
                    const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})/);
                    if (m) { ip = m[1]; mac = m[2].replace(/-/g, ':').toUpperCase(); }
                }
                if (ip && mac && !mac.includes('INCOMPLETE')) devices.push({ ip, mac });
            }
            resolve(devices);
        });
    });
}

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Network Scanner</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #0f0f1a, #1a1a2e); min-height: 100vh; color: #fff; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { text-align: center; margin: 30px 0; }
        .header h1 { font-size: 48px; background: linear-gradient(90deg, #00ff88, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .warning { background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: 10px; padding: 15px; margin-bottom: 30px; color: #ffc107; text-align: center; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .info-card { background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.2); border-radius: 12px; padding: 20px; text-align: center; }
        .info-card .label { color: #8892b0; font-size: 12px; }
        .info-card .value { font-size: 18px; font-weight: bold; color: #00ff88; margin-top: 5px; }
        .scan-btn { display: block; width: 100%; max-width: 300px; margin: 0 auto 40px; padding: 20px; font-size: 20px; font-weight: bold; background: linear-gradient(135deg, #00ff88, #00d4ff); border: none; border-radius: 50px; color: #0f0f1a; cursor: pointer; }
        .scan-btn:hover { transform: scale(1.02); box-shadow: 0 0 30px rgba(0,255,136,0.4); }
        .scan-btn:disabled { opacity: 0.6; }
        .results { display: none; }
        .results.active { display: block; }
        .results h2 { margin-bottom: 20px; color: #00d4ff; display: flex; align-items: center; gap: 10px; }
        .count { background: linear-gradient(135deg, #00ff88, #00d4ff); color: #0f0f1a; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
        .devices { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .device { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; }
        .device:hover { transform: translateY(-5px); border-color: #00ff88; }
        .device-icon { font-size: 40px; margin-bottom: 10px; }
        .device-name { font-weight: bold; margin-bottom: 10px; }
        .device-detail { display: flex; justify-content: space-between; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 5px; margin-top: 5px; font-size: 14px; }
        .device-detail span:first-child { color: #8892b0; }
        .device-detail span:last-child { color: #00ff88; font-family: monospace; }
        .loading, .error { text-align: center; padding: 50px; color: #8892b0; }
        .spinner { font-size: 50px; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🔍 Network Scanner</h1><p>أداة فحص الشبكة - للأغراض التعليمية فقط</p></div>
        <div class="warning">⚠️ تنبيه: هذه الأداة للاستخدام التعليمي فقط</div>
        <div class="info-grid" id="networkInfo"><div class="info-card"><div class="label">جاري التحميل...</div><div class="value">⏳</div></div></div>
        <button class="scan-btn" id="scanBtn" onclick="startScan()">🚀 ابدأ الفحص</button>
        <div class="results" id="results"><h2>📱 الأجهزة المكتشفة <span class="count" id="deviceCount">0</span></h2><div class="devices" id="devices"></div></div>
    </div>
    <script>
        async function loadInfo() {
            try {
                const res = await fetch('/api/network-info');
                const data = await res.json();
                if (!data || data.length === 0) {
                    document.getElementById('networkInfo').innerHTML = '<div class="info-card"><div class="label">الحالة</div><div class="value" style="color:#ff6b6b">❌ لا توجد شبكة</div></div>';
                    return;
                }
                const d = data[0];
                document.getElementById('networkInfo').innerHTML = '<div class="info-card"><div class="label">الواجهة</div><div class="value">'+d.name+'</div></div><div class="info-card"><div class="label">IP</div><div class="value">'+d.ip+'</div></div><div class="info-card"><div class="label">MAC</div><div class="value" style="font-size:14px">'+d.mac+'</div></div><div class="info-card"><div class="label">Subnet</div><div class="value">'+d.netmask+'</div></div>';
            } catch (e) { document.getElementById('networkInfo').innerHTML = '<div class="error">❌ خطأ في الاتصال</div>'; }
        }
        async function startScan() {
            const btn = document.getElementById('scanBtn');
            const results = document.getElementById('results');
            const devices = document.getElementById('devices');
            btn.disabled = true; btn.textContent = '🔄 جاري الفحص...';
            results.classList.add('active');
            devices.innerHTML = '<div class="loading"><div class="spinner">⏳</div><p>جاري البحث...</p></div>';
            try {
                const res = await fetch('/api/scan');
                const data = await res.json();
                if (!data.devices || data.devices.length === 0) { devices.innerHTML = '<div class="loading"><p>🔍 لم يتم العثور على أجهزة</p></div>'; document.getElementById('deviceCount').textContent = '0'; }
                else {
                    document.getElementById('deviceCount').textContent = data.devices.length;
                    devices.innerHTML = data.devices.map(d => {
                        const icon = d.hostname && d.hostname.toLowerCase().includes('router') ? '📡' : d.hostname && (d.hostname.toLowerCase().includes('android') || d.hostname.toLowerCase().includes('iphone')) ? '📱' : d.hostname && d.hostname.toLowerCase().includes('laptop') ? '💻' : '🖥️';
                        const isLocal = d.ip === data.interface?.ip;
                        return '<div class="device"><div class="device-icon">'+icon+'</div><div class="device-name">'+(d.hostname || d.ip)+(isLocal ? ' <span style="color:#00ff88">(جهازك)</span>' : '')+'</div><div class="device-detail"><span>IP</span><span>'+d.ip+'</span></div></div>';
                    }).join('');
                }
            } catch (e) { devices.innerHTML = '<div class="error">❌ حدث خطأ</div>'; }
            btn.disabled = false; btn.textContent = '🚀 ابدأ الفحص';
        }
        loadInfo();
    </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
    if (req.url === '/api/network-info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getNetworkInfo()));
        return;
    }
    if (req.url === '/api/scan') {
        const info = getNetworkInfo();
        if (info.length === 0) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No network', devices: [] })); return; }
        const iface = info[0];
        const baseIp = iface.ip.split('.').slice(0, 3).join('.');
        Promise.all([arpScan(), Promise.all(Array.from({length: 30}, (_, i) => pingHost(baseIp + '.' + (i+1)))])
            .then(([arpDevices, pingResults]) => {
                const alive = pingResults.filter(r => r.alive).map(r => r.ip);
                const allIps = [...new Set([...arpDevices.map(d => d.ip), ...alive])];
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ interface: iface, devices: allIps.map(ip => ({ ip, hostname: ip })) }));
            });
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       🔍 Network Scanner Started!       ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║                                          ║');
    console.log('║   🌐 http://localhost:' + PORT + '             ║');
    console.log('║   📱 http://127.0.0.1:' + PORT + '             ║');
    console.log('║                                          ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
ENDOFFILE

echo "✅ Server created!"
echo ""
echo "Starting server..."
node server.js
