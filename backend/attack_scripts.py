#!/usr/bin/env python3
"""
SentinalIQ - Attack Simulation Scripts
=======================================
Use these scripts to generate realistic attack traffic for testing
the Live Monitoring feature. Run them against the API server.

Usage:
  python attack_scripts.py --attack sqli        # Single SQL injection
  python attack_scripts.py --attack wave        # Attack wave (random)
  python attack_scripts.py --attack ddos        # DDoS simulation
  python attack_scripts.py --wave-size 50       # Custom wave size
  python attack_scripts.py --continuous         # Continuous attacks every 5s
"""

import sys
import json
import time
import random
import os
import requests
import argparse


# Backend API base. Override with the SENTINALIQ_API env var so the attacker can
# point the script at the friend's backend when they are on different machines,
# e.g.  SENTINALIQ_API=http://192.168.1.50:8000/api
API_BASE = os.environ.get("SENTINALIQ_API", "http://localhost:8000/api")
TOKEN = None
TARGET_URL = None  # Set via --target argument to target a monitored website
USERNAME = "admin"
PASSWORD = "admin123"


def authenticate():
    """Login and get auth token for the configured user"""
    global TOKEN
    try:
        res = requests.post(f"{API_BASE}/auth/login", json={
            "username": USERNAME,
            "password": PASSWORD
        })
        if res.ok:
            data = res.json()
            TOKEN = data["access_token"]
            print(f"[✓] Authenticated as {USERNAME} (token: {TOKEN[:20]}...)")
            return True
        else:
            # Try registering first
            res = requests.post(f"{API_BASE}/auth/register", json={
                "username": USERNAME,
                "email": f"{USERNAME}@sentinaliq.com",
                "password": PASSWORD
            })
            if res.ok:
                data = res.json()
                TOKEN = data["access_token"]
                print(f"[✓] Registered & authenticated as {USERNAME}")
                return True
            print(f"[✗] Auth failed: {res.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("[✗] Cannot connect to server. Make sure the backend is running on port 8000.")
        return False


def headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _warn_if_unmonitored(data: dict):
    """Explain why nothing will appear in a dashboard when the targeted URL is
    not being monitored by any user on this backend."""
    if TARGET_URL and not data.get("websites"):
        print("    ⚠️  No user is currently monitoring this URL — no incident was created.")
        print("        The friend must add it first: Live Monitor → 'Start Monitoring'")
        print("        on the SAME backend, then re-run the attack with the exact same URL.")


# ─── Attack Scripts ──────────────────────────────────────────────────────────

def _attack_payload(attack_type: str, severity: str, extra: dict = None):
    """Send an attack to the API, optionally targeting a monitored website"""
    body = {"type": attack_type, "severity": severity}
    if extra:
        body.update(extra)
    if TARGET_URL:
        body["target_url"] = TARGET_URL
    
    res = requests.post(
        f"{API_BASE}/monitor/simulate-attack",
        json=body,
        headers=headers()
    )
    if res.ok:
        data = res.json()
        print(f"    Status:  {data.get('status', 'blocked').upper()}")
        print(f"    Source:  {data.get('source_ip')} ({data.get('source_country')})")
        _warn_if_unmonitored(data)
        # Handle new format: incidents[] and websites[] arrays
        if data.get('incidents'):
            for inc in data['incidents']:
                print(f"    🚨 Incident created for website owner: {inc.get('title', '')} [{inc.get('severity', '?')}]")
        elif data.get('incident'):
            inc = data['incident']
            print(f"    🚨 Incident created: {inc.get('title', '')} [{inc.get('severity', '?')}]")
        if data.get('websites'):
            for w in data['websites']:
                print(f"    📊 Website '{w.get('hostname', '?')}' threat score: {w.get('threat_score', '?')}/100 [{w.get('threat_level', '?')}]")
        elif data.get('website'):
            w = data['website']
            print(f"    📊 Website threat score: {w.get('threat_score', '?')}/100 [{w.get('threat_level', '?')}]")
    else:
        print(f"    [✗] Failed: {res.text}")
    return res.ok


def sql_injection_attack():
    """Simulate SQL injection attack"""
    payload = random.choice([
        "' OR 1=1--",
        "admin' --",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM credentials--",
    ])
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[⚡] SQL Injection Attack{target_str}")
    print(f"    Payload: {payload}")
    return _attack_payload("injection", random.choice(["high", "critical"]), {"payload": payload})


def xss_attack():
    """Simulate XSS attack"""
    payload = random.choice([
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg onload=alert(document.cookie)>",
    ])
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[⚡] XSS Attack{target_str}")
    print(f"    Payload: {payload[:60]}...")
    return _attack_payload("xss", random.choice(["medium", "high"]), {"payload": payload})


def brute_force_attack():
    """Simulate brute force login attack"""
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[⚡] Brute Force Attack{target_str}")
    return _attack_payload("brute_force", "high")


def port_scan_attack():
    """Simulate port scanning"""
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[⚡] Port Scan Attack{target_str}")
    return _attack_payload("scan", "medium")


def ddos_attack():
    """Simulate DDoS attack"""
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[⚡] DDoS Attack{target_str}")
    count = random.randint(10, 30)
    print(f"    Wave size: {count} requests")
    
    res = requests.post(
        f"{API_BASE}/monitor/simulate-wave",
        json={"count": count, "target_url": TARGET_URL if TARGET_URL else None},
        headers=headers()
    )
    if res.ok:
        data = res.json()
        print(f"    Simulated: {data.get('simulated', 0)} events")
        print(f"    Message:  {data.get('message', '')}")
        _warn_if_unmonitored(data)
    else:
        print(f"    [✗] Failed: {res.text}")
    return res.ok


def path_traversal_attack():
    """Simulate path traversal attack"""
    path = random.choice([
        "../../../etc/passwd",
        "../../../../etc/shadow",
        "/../../../proc/self/environ",
    ])
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[⚡] Path Traversal Attack{target_str}")
    print(f"    Path:    {path}")
    return _attack_payload("path_traversal", "high", {"path": path})


def attack_wave(count=10):
    """Simulate a mixed wave of attacks"""
    target_str = f" → {TARGET_URL}" if TARGET_URL else ""
    print(f"\n[🌊] Attack Wave{target_str} ({count} events)")
    types = ["injection", "xss", "brute_force", "scan", "ddos", "malware", "path_traversal", "csrf"]
    print(f"    Types:   {', '.join(types[:4])}...")
    
    res = requests.post(
        f"{API_BASE}/monitor/simulate-wave",
        json={"count": count, "target_url": TARGET_URL if TARGET_URL else None},
        headers=headers()
    )
    if res.ok:
        data = res.json()
        print(f"    Simulated: {data.get('simulated', 0)} events")
        _warn_if_unmonitored(data)
        events = data.get('events', [])
        for e in events[:5]:
            print(f"    • [{e.get('severity','?').upper()}] {e.get('event_type','?')} → {e.get('status','?')}")
        if len(events) > 5:
            print(f"    ... and {len(events) - 5} more")
    else:
        print(f"    [✗] Failed: {res.text}")
    return res.ok


def full_security_assessment():
    """Run a complete security assessment simulation"""
    target_str = f" targeting {TARGET_URL}" if TARGET_URL else ""
    print("\n" + "="*60)
    print(f"  🔍 SENTINALIQ SECURITY ASSESSMENT{target_str}")
    print("="*60)
    
    print("\n[1/6] Scanning for open ports...")
    time.sleep(0.5)
    port_scan_attack()
    
    print("\n[2/6] Testing SQL injection vulnerabilities...")
    time.sleep(0.3)
    sql_injection_attack()
    
    print("\n[3/6] Testing XSS vulnerabilities...")
    time.sleep(0.3)
    xss_attack()
    
    print("\n[4/6] Attempting brute force login...")
    time.sleep(0.3)
    brute_force_attack()
    
    print("\n[5/6] Testing path traversal...")
    time.sleep(0.3)
    path_traversal_attack()
    
    print("\n[6/6] Simulating DDoS...")
    time.sleep(0.3)
    ddos_attack()
    
    print("\n" + "="*60)
    print(f"  ✓ Assessment complete! Check Live Monitor for results.")
    print("="*60)


def continuous_attacks(interval=5):
    """Run continuous attacks at a fixed interval"""
    print(f"\n[🔄] Continuous Attack Mode (every {interval}s)")
    print("     Press Ctrl+C to stop\n")
    
    attack_funcs = [
        sql_injection_attack,
        xss_attack,
        brute_force_attack,
        port_scan_attack,
        path_traversal_attack,
    ]
    
    try:
        count = 0
        while True:
            count += 1
            print(f"\n{'─'*40}")
            print(f"  Attack #{count} — {time.strftime('%H:%M:%S')}")
            print(f"{'─'*40}")
            
            func = random.choice(attack_funcs)
            func()
            
            if count % 3 == 0:
                print(f"\n  [🌊] Triggering attack wave in background...")
                requests.post(
                    f"{API_BASE}/monitor/simulate-wave",
                    json={"count": random.randint(5, 15)},
                    headers=headers()
                )
            
            print(f"\n  [⏳] Next attack in {interval}s...")
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n\n[⏹] Stopped after {count} attacks")
        print(f"    Check the Live Monitor for results!")


# ─── CLI Entry Point ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SentinalIQ Attack Simulation Scripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python attack_scripts.py --attack sqli        # Single SQL injection
  python attack_scripts.py --attack wave        # Random attack wave
  python attack_scripts.py --attack assessment  # Full security assessment
  python attack_scripts.py --continuous         # Continuous attacks
  python attack_scripts.py --wave-size 100      # Large attack wave
        """
    )
    parser.add_argument(
        "--attack", "-a",
        choices=["sqli", "xss", "bruteforce", "scan", "ddos", "traversal", "wave", "assessment", "all"],
        default="all",
        help="Type of attack to simulate"
    )
    parser.add_argument(
        "--wave-size", "-w",
        type=int,
        default=15,
        help="Number of events in an attack wave (default: 15)"
    )
    parser.add_argument(
        "--continuous", "-c",
        action="store_true",
        help="Run continuous attacks every N seconds"
    )
    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=5,
        help="Interval between continuous attacks in seconds (default: 5)"
    )
    parser.add_argument(
        "--target", "-t",
        type=str,
        default=None,
        help="Target a specific monitored website URL (e.g., https://example.com)"
    )
    parser.add_argument(
        "--username", "-u",
        type=str,
        default="admin",
        help="Username to authenticate as (default: admin)"
    )
    parser.add_argument(
        "--password", "-p",
        type=str,
        default="admin123",
        help="Password for the user (default: admin123)"
    )
    
    args = parser.parse_args()
    
    # Set credentials globally
    global USERNAME, PASSWORD
    USERNAME = args.username
    PASSWORD = args.password
    
    # Authenticate first
    if not authenticate():
        sys.exit(1)
    
    # Set target URL globally
    global TARGET_URL
    TARGET_URL = args.target
    if TARGET_URL:
        print(f"[🎯] Targeting monitored website: {TARGET_URL}")
    else:
        print("[💡] Tip: use --target <url> to attack a website your friend is monitoring")
    
    # Run the selected attack
    if args.continuous:
        continuous_attacks(interval=args.interval)
        return
    
    attack_map = {
        "sqli": sql_injection_attack,
        "xss": xss_attack,
        "bruteforce": brute_force_attack,
        "scan": port_scan_attack,
        "ddos": ddos_attack,
        "traversal": path_traversal_attack,
        "wave": lambda: attack_wave(args.wave_size),
        "assessment": full_security_assessment,
        "all": full_security_assessment,
    }
    
    func = attack_map.get(args.attack)
    if func:
        result = func()
        if not result:
            sys.exit(1)
    else:
        print(f"Unknown attack type: {args.attack}")
        sys.exit(1)


if __name__ == "__main__":
    main()
