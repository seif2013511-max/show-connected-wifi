# ⚠️ Network Scanner Tool

## ⚠️ IMPORTANT LEGAL NOTICE

**This tool is for EDUCATIONAL purposes ONLY.**

### Permitted Uses:
- ✅ Scanning your own devices and network
- ✅ Authorized penetration testing with written permission
- ✅ Learning network security concepts
- ✅ IT administration on networks you manage

### Prohibited Uses:
- ❌ Scanning networks without permission
- ❌ Accessing devices you don't own
- ❌ Any unauthorized testing
- ❌ Collecting data illegally

**Legal Consequences:** Unauthorized network scanning is illegal in most countries and may result in criminal charges.

---

## Setup

```bash
npm install
```

## Usage

```bash
# Show help
node scanner.js --help

# Quick ARP scan
node scanner.js

# Ping sweep
node scanner.js --ping-sweep

# Port scan specific IP
node scanner.js --port-scan --target 192.168.1.1

# Full scan
node scanner.js --ping-sweep --port-scan --target 192.168.1.1
```

## Features

1. **Local Network Detection** - Shows your network interfaces
2. **ARP Scan** - Lists devices from ARP table
3. **Ping Sweep** - Discovers live hosts
4. **Port Scan** - Checks common ports on target

---
*Use responsibly and only on networks you own or have permission to test.*
