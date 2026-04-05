/**
 * ============================================
 * ⚠️  NETWORK SCANNER - FOR EDUCATIONAL USE  ⚠️
 * ============================================
 * 
 * WARNING: Only scan networks you own or have
 * explicit written permission to test.
 * Unauthorized scanning is ILLEGAL.
 */

const { exec } = require('child_process');
const os = require('os');

// Get local network info
function getLocalNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const results = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                results.push({
                    name: name,
                    ip: addr.address,
                    netmask: addr.netmask,
                    mac: addr.mac
                });
            }
        }
    }
    return results;
}

// Calculate network range from IP and netmask
function calculateNetworkRange(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const network = ipParts.map((part, i) => part & maskParts[i]);
    const broadcast = ipParts.map((part, i) => part | (~maskParts[i] & 255));
    return {
        network: network.join('.'),
        start: network.join('.'),
        end: broadcast.join('.'),
        range: `${network.slice(0, 3).join('.')}.0/24`
    };
}

// Ping sweep using system ping command
function pingHost(ip) {
    return new Promise((resolve) => {
        const cmd = process.platform === 'win32'
            ? `ping -n 1 -w 100 ${ip}`
            : `ping -c 1 -W 1 ${ip}`;

        exec(cmd, (error) => {
            resolve({ ip, alive: !error });
        });
    });
}

// ARP scan (requires root/admin)
function arpScan() {
    return new Promise((resolve) => {
        const cmd = process.platform === 'win32'
            ? 'arp -a'
            : 'arp -a';

        exec(cmd, (error, stdout) => {
            if (error) {
                resolve({ error: error.message, devices: [] });
                return;
            }

            const devices = [];
            const lines = stdout.split('\n');

            for (const line of lines) {
                const match = line.match(/((?:\d{1,3}\.){3}\d{1,3})[\s\S]*?(([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})/);
                if (match) {
                    devices.push({
                        ip: match[1],
                        mac: match[2]
                    });
                }
            }
            resolve({ devices });
        });
    });
}

// Nmap scan (if installed)
function nmapScan(target) {
    return new Promise((resolve) => {
        exec(`nmap -sn ${target}`, (error, stdout) => {
            if (error) {
                resolve({ error: 'nmap not installed', output: null });
                return;
            }
            resolve({ output: stdout });
        });
    });
}

// Port scan function
function scanPorts(ip, ports = [21, 22, 23, 80, 443, 3389, 8080]) {
    return new Promise((resolve) => {
        const openPorts = [];
        let completed = 0;

        for (const port of ports) {
            const cmd = process.platform === 'win32'
                ? `powershell -Command "Test-NetConnection -ComputerName ${ip} -Port ${port} -InformationLevel Quiet"`
                : `nc -zv -w 1 ${ip} ${port} 2>&1`;

            exec(cmd, (error, stdout) => {
                if (!error || stdout.includes('open') || stdout.includes('succeeded')) {
                    openPorts.push(port);
                }
                completed++;
                if (completed === ports.length) {
                    resolve({ ip, openPorts });
                }
            });
        }
    });
}

// Main scanner function
async function scanNetwork(options = {}) {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     NETWORK SCANNER - EDUCATIONAL       ║');
    console.log('║     Use only on networks you own!        ║');
    console.log('╚══════════════════════════════════════════╝\n');

    const localInfo = getLocalNetworkInfo();

    if (localInfo.length === 0) {
        console.log('❌ No network interfaces found');
        return;
    }

    console.log('📡 Local Network Interfaces:\n');
    localInfo.forEach((iface, i) => {
        console.log(`   [${i + 1}] ${iface.name}`);
        console.log(`       IP: ${iface.ip}`);
        console.log(`       MAC: ${iface.mac}\n`);
    });

    // Use first interface
    const iface = localInfo[0];
    console.log(`🔍 Scanning network: ${iface.ip}/24\n`);

    // Method 1: ARP Scan
    console.log('─── ARP Table ───');
    const arpResult = await arpScan();
    if (arpResult.devices && arpResult.devices.length > 0) {
        arpResult.devices.forEach(device => {
            console.log(`   📱 ${device.ip.padEnd(15)} MAC: ${device.mac}`);
        });
    } else {
        console.log('   No devices found in ARP table');
    }

    // Method 2: Ping Sweep
    if (options.pingSweep) {
        console.log('\n─── Ping Sweep ───');
        const baseIp = iface.ip.split('.').slice(0, 3).join('.');
        const promises = [];

        for (let i = 1; i <= 254; i++) {
            promises.push(pingHost(`${baseIp}.${i}`));
        }

        const results = await Promise.all(promises);
        const aliveHosts = results.filter(r => r.alive);

        console.log(`   Found ${aliveHosts.length} live hosts`);
        aliveHosts.slice(0, 10).forEach(host => {
            console.log(`   ✅ ${host.ip} is alive`);
        });
    }

    // Method 3: Port Scan
    if (options.portScan && options.targetIp) {
        console.log(`\n─── Port Scan on ${options.targetIp} ───`);
        const portResult = await scanPorts(options.targetIp);
        console.log(`   Open ports: ${portResult.openPorts.join(', ') || 'None'}`);
    }

    console.log('\n✅ Scan complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// CLI Interface
function showHelp() {
    console.log(`
🛠️  Network Scanner Usage:

   node scanner.js [options]
   
Options:
   --ping-sweep    Run ping sweep on network
   --port-scan     Scan specific IP for ports
   --target <IP>   Target IP for port scanning
   --help          Show this help message

Examples:
   node scanner.js                      # Quick ARP scan
   node scanner.js --ping-sweep         # Scan with ping
   node scanner.js --ping-sweep --port-scan --target 192.168.1.1

⚠️  LEGAL NOTICE:
   This tool is for EDUCATIONAL purposes only.
   Only scan networks you own or have written permission to test.
   Unauthorized use is ILLEGAL and punishable by law.
`);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
    showHelp();
    process.exit(0);
}

const options = {
    pingSweep: args.includes('--ping-sweep'),
    portScan: args.includes('--port-scan'),
    targetIp: null
};

// Extract target IP
const targetIndex = args.indexOf('--target');
if (targetIndex !== -1 && args[targetIndex + 1]) {
    options.targetIp = args[targetIndex + 1];
}

// Run scanner
scanNetwork(options).catch(console.error);
