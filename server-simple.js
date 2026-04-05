/**
 * Network Scanner - Simple Server (No dependencies!)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;

// Detect OS
const isWindows = os.platform() === 'win32';

// Get network info
function getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const results = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                results.push({
                    name: name,
                    ip: addr.address,
                    mac: addr.mac || 'N/A',
                    netmask: addr.netmask || 'N/A'
                });
            }
        }
    }
    return results;
}

// Ping host
function pingHost(ip) {
    return new Promise((resolve) => {
        const cmd = isWindows
            ? `ping -n 1 -w 500 ${ip}`
            : `ping -c 1 -W 1 ${ip}`;

        exec(cmd, { timeout: 2000 }, (error) => {
            resolve({ ip, alive: !error });
        });
    });
}

// ARP scan
function arpScan() {
    return new Promise((resolve) => {
        exec('arp -a', { timeout: 5000 }, (error, stdout) => {
            if (error) return resolve([]);

            const devices = [];
            const lines = stdout.split('\n');

            for (const line of lines) {
                let ip, mac;

                if (isWindows) {
                    const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})/);
                    if (match) {
                        ip = match[1];
                        mac = match[2].replace(/-/g, ':').toUpperCase();
                    }
                } else {
                    const ipMatch = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
                    const macMatch = line.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
                    if (ipMatch && macMatch) {
                        ip = ipMatch[1];
                        mac = macMatch[1].toUpperCase();
                    }
                }

                if (ip && mac && !mac.includes('INCOMPLETE')) {
                    devices.push({ ip, mac });
                }
            }
            resolve(devices);
        });
    });
}

// HTML Page
const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Scanner</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-size: 48px; margin-bottom: 10px; }
        .header p { color: #8892b0; }
        .warning {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 30px;
            color: #ffc107;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .info-card {
            background: rgba(0, 255, 136, 0.05);
            border: 1px solid rgba(0, 255, 136, 0.2);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .info-card .label { color: #8892b0; font-size: 12px; margin-bottom: 5px; }
        .info-card .value { font-size: 18px; font-weight: bold; color: #00ff88; }
        .scan-btn {
            display: block;
            width: 100%;
            max-width: 300px;
            margin: 0 auto 40px;
            padding: 20px;
            font-size: 20px;
            font-weight: bold;
            background: linear-gradient(135deg, #00ff88, #00d4ff);
            border: none;
            border-radius: 50px;
            color: #0f0f1a;
            cursor: pointer;
        }
        .scan-btn:hover { transform: scale(1.02); box-shadow: 0 0 30px rgba(0, 255, 136, 0.4); }
        .scan-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .results { display: none; }
        .results.active { display: block; }
        .results h2 { margin-bottom: 20px; color: #00d4ff; }
        .count { 
            background: linear-gradient(135deg, #00ff88, #00d4ff);
            color: #0f0f1a;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
        }
        .devices { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .device {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 20px;
            transition: all 0.3s;
        }
        .device:hover { transform: translateY(-5px); border-color: #00ff88; }
        .device-icon { font-size: 40px; margin-bottom: 10px; }
        .device-name { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
        .device-detail { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px;
            background: rgba(0,0,0,0.2);
            border-radius: 5px;
            margin-top: 5px;
        }
        .device-detail span:first-child { color: #8892b0; font-size: 12px; }
        .device-detail span:last-child { color: #00ff88; font-family: monospace; }
        .loading { text-align: center; padding: 50px; color: #8892b0; }
        .spinner { font-size: 50px; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error { text-align: center; padding: 30px; color: #ff6b6b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Network Scanner</h1>
            <p>أداة فحص الشبكة - للأغراض التعليمية فقط</p>
        </div>
        
        <div class="warning">
            ⚠️ تنبيه: هذه الأداة مخصصة للاستخدام التعليمي فقط
        </div>
        
        <div class="info-grid" id="networkInfo">
            <div class="info-card">
                <div class="label">جاري التحميل...</div>
                <div class="value">⏳</div>
            </div>
        </div>
        
        <button class="scan-btn" id="scanBtn" onclick="startScan()">
            🚀 ابدأ الفحص
        </button>
        
        <div class="results" id="results">
            <h2>📱 الأجهزة المكتشفة <span class="count" id="deviceCount">0</span></h2>
            <div class="devices" id="devices"></div>
        </div>
    </div>

    <script>
        async function loadInfo() {
            try {
                const res = await fetch('/api/network-info');
                const data = await res.json();
                
                if (!data || data.length === 0) {
                    document.getElementById('networkInfo').innerHTML = 
                        '<div class="info-card"><div class="label">الحالة</div><div class="value" style="color:#ff6b6b">❌ لا توجد شبكة</div></div>';
                    return;
                }
                
                const d = data[0];
                document.getElementById('networkInfo').innerHTML = \`
                    <div class="info-card"><div class="label">الواجهة</div><div class="value">\${d.name}</div></div>
                    <div class="info-card"><div class="label">IP</div><div class="value">\${d.ip}</div></div>
                    <div class="info-card"><div class="label">MAC</div><div class="value" style="font-size:14px">\${d.mac}</div></div>
                    <div class="info-card"><div class="label">Subnet</div><div class="value">\${d.netmask}</div></div>
                \`;
            } catch (e) {
                document.getElementById('networkInfo').innerHTML = 
                    '<div class="error">❌ خطأ في الاتصال. تأكد من تشغيل السيرفر</div>';
            }
        }
        
        async function startScan() {
            const btn = document.getElementById('scanBtn');
            const results = document.getElementById('results');
            const devices = document.getElementById('devices');
            
            btn.disabled = true;
            btn.textContent = '🔄 جاري الفحص...';
            results.classList.add('active');
            devices.innerHTML = '<div class="loading"><div class="spinner">⏳</div><p>جاري البحث عن الأجهزة...</p></div>';
            
            try {
                const res = await fetch('/api/scan');
                const data = await res.json();
                
                if (data.error || !data.devices || data.devices.length === 0) {
                    devices.innerHTML = '<div class="loading"><p>🔍 لم يتم العثور على أجهزة</p></div>';
                    document.getElementById('deviceCount').textContent = '0';
                } else {
                    document.getElementById('deviceCount').textContent = data.devices.length;
                    devices.innerHTML = data.devices.map(d => {
                        const icon = getIcon(d.hostname);
                        const isLocal = d.ip === data.interface?.ip;
                        return \`
                            <div class="device">
                                <div class="device-icon">\${icon}</div>
                                <div class="device-name">\${d.hostname || d.ip}\${isLocal ? ' <span style="color:#00ff88">(جهازك)</span>' : ''}</div>
                                <div class="device-detail"><span>IP</span><span>\${d.ip}</span></div>
                                <div class="device-detail"><span>النوع</span><span>\${getType(d.hostname)}</span></div>
                            </div>
                        \`;
                    }).join('');
                }
            } catch (e) {
                devices.innerHTML = '<div class="error">❌ حدث خطأ</div>';
            }
            
            btn.disabled = false;
            btn.textContent = '🚀 ابدأ الفحص';
        }
        
        function getIcon(hostname) {
            const h = (hostname || '').toLowerCase();
            if (h.includes('router') || h.includes('gateway')) return '📡';
            if (h.includes('android') || h.includes('iphone')) return '📱';
            if (h.includes('laptop') || h.includes('macbook')) return '💻';
            if (h.includes('tv')) return '📺';
            if (h.includes('printer')) return '🖨️';
            return '🖥️';
        }
        
        function getType(hostname) {
            const h = (hostname || '').toLowerCase();
            if (h.includes('router')) return 'راوتر';
            if (h.includes('android') || h.includes('iphone')) return 'هاتف';
            if (h.includes('laptop')) return 'لابتوب';
            if (h.includes('tv')) return 'تلفزيون';
            if (h.includes('printer')) return 'طابعة';
            return 'جهاز';
        }
        
        loadInfo();
    </script>
</body>
</html>`;

// Create server
const server = http.createServer((req, res) => {
    // API routes
    if (req.url === '/api/network-info') {
        const info = getNetworkInfo();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(info));
        return;
    }

    if (req.url === '/api/scan') {
        const info = getNetworkInfo();

        if (info.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No network', devices: [] }));
            return;
        }

        const iface = info[0];
        const baseIp = iface.ip.split('.').slice(0, 3).join('.');

        // ARP scan
        const arpDevices = arpScan();

        // Ping sweep (first 30 hosts)
        const pingPromises = [];
        for (let i = 1; i <= 30; i++) {
            pingPromises.push(pingHost(`${baseIp}.${i}`));
        }

        Promise.all(pingPromises).then((pingResults) => {
            const alive = pingResults.filter(r => r.alive).map(r => r.ip);

            // Get unique IPs from both methods
            const arpIps = [];
            arpScan().then(arpDevices => {
                arpDevices.forEach(d => arpIps.push(d.ip));

                const allIps = [...new Set([...arpIps, ...alive])];
                const devices = allIps.map(ip => ({ ip, hostname: ip }));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ interface: iface, devices }));
            });
        });
        return;
    }

    // Serve HTML
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       🔍 Network Scanner Started!       ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║                                          ║');
    console.log('║   🌐 http://localhost:' + PORT);
    console.log('║   📱 http://127.0.0.1:' + PORT);
    console.log('║                                          ║');
    console.log('╚══════════════════════════════════════════╝');
});
