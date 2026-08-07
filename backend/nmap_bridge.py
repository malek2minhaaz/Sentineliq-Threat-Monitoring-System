#!/usr/bin/env python3
"""
SentinalIQ - Nmap Recon Bridge
===============================
Runs REAL nmap scans against a website that is being monitored in
SentinalIQ and turns the findings into high-severity "port scan"
incidents — so reconnaissance (the first step of an attack chain)
shows up as incident response in Live Monitor and the dashboard.

Flow:
  1. Check nmap is installed, then authenticate to the backend
     (same convention as attack_scripts.py: login, or register).
  2. Run `nmap` against the target host (a real scan).
  3. Parse open ports + service versions from nmap's XML output.
  4. Push a "scan" attack carrying the REAL findings (ports, services,
     payload, message) to POST /api/monitor/simulate-attack.
  5. In --continuous mode, re-scan on an interval. Repeated scans that
     keep finding open ports escalate severity high -> critical
     ("recon persistence" — the attacker keeps coming back).

Usage:
  python nmap_bridge.py --target https://example.com
  python nmap_bridge.py --target example.com --continuous --interval 60
  python nmap_bridge.py --target example.com --ports "22,80,443,8080"
  python nmap_bridge.py --target example.com --continuous --escalate --follow-up
  python nmap_bridge.py --target example.com --dry-run

Requirements:
  - nmap installed and on PATH  (https://nmap.org)
  - Backend running, or SENTINALIQ_API pointing at it
  - The target URL must be monitored by a user on that backend,
    otherwise no incident is created (the script prints a ⚠️ warning)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from typing import Optional
from urllib.parse import urlparse

# Keep emoji/unicode output from crashing on Windows cp1252 consoles
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

import requests

API_BASE = os.environ.get("SENTINALIQ_API", "http://localhost:8000/api")
USERNAME = "admin"
PASSWORD = "admin123"

ESCALATE_AFTER = 2  # consecutive scans with open ports before severity -> critical


# ─── Auth ──────────────────────────────────────────────────────────────────

def authenticate(dry_run: bool = False):
    """Login (or register) and return a bearer token for the backend."""
    if dry_run:
        print("[dry-run] Skipping authentication")
        return None
    try:
        res = requests.post(
            f"{API_BASE}/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=15,
        )
        if res.ok:
            data = res.json()
            print(f"[✓] Authenticated as {USERNAME} (token: {data['access_token'][:20]}...)")
            return data["access_token"]
        # Try registering first
        res = requests.post(
            f"{API_BASE}/auth/register",
            json={"username": USERNAME, "email": f"{USERNAME}@sentinaliq.io", "password": PASSWORD},
            timeout=15,
        )
        if res.ok:
            data = res.json()
            print(f"[✓] Registered & authenticated as {USERNAME}")
            return data["access_token"]
        print(f"[✗] Auth failed: {res.text}")
    except requests.exceptions.ConnectionError:
        print("[✗] Cannot connect to backend. Make sure it's running on port 8000 (or set SENTINALIQ_API).")
    sys.exit(1)


def headers(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── nmap execution ────────────────────────────────────────────────────────

def find_nmap() -> Optional[str]:
    """Locate the nmap executable.

    Checks PATH first, then the standard Windows install locations — winget
    installs nmap to 'Program Files (x86)/Nmap' but never refreshes the PATH
    of terminals that were already open, so shutil.which() alone would miss it.
    """
    exe = shutil.which("nmap")
    if exe:
        return exe
    if os.name == "nt":
        for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles")):
            if base:
                candidate = os.path.join(base, "Nmap", "nmap.exe")
                if os.path.isfile(candidate):
                    return candidate
    return None


def run_nmap(nmap_exe: str, host: str, args) -> list:
    """Run a real nmap scan and return the list of open ports found."""
    cmd = [nmap_exe]
    if args.nmap_args:
        cmd += args.nmap_args.split()
    else:
        if args.version_detect:
            cmd += ["-sV"]  # slower service/version detection — opt in
        if args.ports:
            cmd += ["-p", args.ports]
        else:
            cmd += ["--top-ports", str(args.top_ports)]
    cmd += ["-oX", "-", host]

    print(f"[🔎] Running: {' '.join(cmd)}")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=args.timeout)
    except subprocess.TimeoutExpired:
        print(f"[✗] nmap timed out after {args.timeout}s. Use --timeout to raise the limit.")
        return []
    except OSError as exc:
        print(f"[✗] Failed to run nmap: {exc}")
        return []
    if proc.returncode != 0:
        print(f"[✗] nmap exited with code {proc.returncode}:")
        print((proc.stderr or proc.stdout).strip() or "  (no output)")
        return []
    return parse_nmap_xml(proc.stdout)


def parse_nmap_xml(xml_text: str) -> list:
    """Extract open ports + service info from nmap's -oX - output."""
    ports = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        print("[✗] Could not parse nmap XML output")
        return ports
    for port in root.iter("port"):
        state = port.find("state")
        if state is None or state.get("state") != "open":
            continue
        service = port.find("service")
        label = "unknown"
        if service is not None:
            name = service.get("name", "") or "unknown"
            product = service.get("product", "")
            version = service.get("version", "")
            label = f"{name} ({product}{' ' + version if version else ''})" if product else name
        ports.append({
            "port": port.get("portid"),
            "protocol": port.get("protocol", "tcp"),
            "service": label,
        })
    return ports


# ─── Pushing findings to SentinalIQ ────────────────────────────────────────

def push_scan_event(token: str, target_url: str, ports: list, severity: str,
                    status: str, extra_note: str = "", dry_run: bool = False) -> bool:
    """Send the real nmap findings to the backend as a 'scan' attack event."""
    if ports:
        port_list = ", ".join(f"{p['port']}/{p['protocol']} ({p['service']})" for p in ports)
        body = {
            "type": "scan",
            "severity": severity,
            "target_url": target_url,
            "method": "SYN",
            "path": "/recon",
            "payload": f"nmap scan → open: {port_list}",
            "message": f"nmap reconnaissance detected — {len(ports)} open port(s) on {target_url}: {port_list}",
            "details": f"Real nmap scan found {len(ports)} open port(s): {port_list}.{extra_note}",
            "status": status,
        }
    else:
        # Clean re-scan — used to mark reconnaissance as resolved
        body = {
            "type": "scan",
            "severity": "low",
            "target_url": target_url,
            "method": "SYN",
            "path": "/recon",
            "payload": "nmap scan → no open ports",
            "message": f"nmap re-scan of {target_url} shows no open ports — reconnaissance cleared.{extra_note}",
            "details": f"Follow-up nmap scan of {target_url} found no open ports. Reconnaissance activity resolved.{extra_note}",
            "status": "mitigated",
        }

    if dry_run:
        print("    [dry-run] Would POST /monitor/simulate-attack:")
        print(json.dumps(body, indent=4))
        return True

    res = requests.post(
        f"{API_BASE}/monitor/simulate-attack",
        json=body,
        headers=headers(token),
        timeout=30,
    )
    if res.ok:
        data = res.json()
        print(f"    Status:  {data.get('status', 'detected').upper()}")
        print(f"    Source:  {data.get('source_ip')} ({data.get('source_country')})")
        if data.get("incidents"):
            for inc in data["incidents"]:
                print(f"    🚨 Incident created: {inc.get('title', '')} [{inc.get('severity', '?')}]")
        elif data.get("incident"):
            inc = data["incident"]
            print(f"    🚨 Incident created: {inc.get('title', '')} [{inc.get('severity', '?')}]")
        if data.get("websites"):
            for w in data["websites"]:
                print(f"    📊 Website '{w.get('hostname', '?')}' threat score: {w.get('threat_score', '?')}/100 [{w.get('threat_level', '?')}]")
        elif data.get("website"):
            w = data["website"]
            print(f"    📊 Website threat score: {w.get('threat_score', '?')}/100 [{w.get('threat_level', '?')}]")
        if target_url and not data.get("websites"):
            print("    ⚠️  No user is monitoring this URL — no incident was created.")
            print("        Add it first: Live Monitor → 'Start Monitoring' on the same backend.")
        return True
    print(f"    [✗] Failed: {res.text}")
    return False


def trigger_follow_up_wave(token: str, target_url: str, dry_run: bool = False):
    """After escalation, simulate the attacker moving from recon to exploitation."""
    body = {"count": 6, "target_url": target_url}
    if dry_run:
        print("    [dry-run] Would POST /monitor/simulate-wave:", json.dumps(body))
        return
    res = requests.post(f"{API_BASE}/monitor/simulate-wave", json=body, headers=headers(token), timeout=30)
    if res.ok:
        data = res.json()
        print(f"    Simulated: {data.get('simulated', 0)} events")
    else:
        print(f"    [✗] Attack wave failed: {res.text}")


# ─── Continuous recon mode ─────────────────────────────────────────────────

def continuous_recon(token: str, target_url: str, host: str, nmap_exe: str, args):
    print(f"\n[🔄] Continuous recon mode — scan every {args.interval}s (Ctrl+C to stop)\n")
    consecutive = 0
    had_detections = False
    count = 0
    try:
        while True:
            count += 1
            print(f"\n{'─' * 40}\n  Scan #{count} — {time.strftime('%H:%M:%S')}\n{'─' * 40}")
            ports = run_nmap(nmap_exe, host, args)
            if not ports:
                consecutive = 0
                if had_detections:
                    print("[✓] No open ports found — reporting reconnaissance as cleared...")
                    push_scan_event(token, target_url, [], "low", "mitigated", "", args.dry_run)
                had_detections = False
            else:
                had_detections = True
                consecutive += 1
                if args.escalate and consecutive >= ESCALATE_AFTER:
                    severity, status, note = "critical", "investigating", " Repeated reconnaissance — escalating to critical."
                    print(f"[⚡] {len(ports)} open port(s) detected — ESCALATING to CRITICAL")
                else:
                    severity, status, note = args.severity, "detected", ""
                    print(f"[⚡] {len(ports)} open port(s) detected (severity: {severity.upper()})")
                push_scan_event(token, target_url, ports, severity, status, note, args.dry_run)
                if args.follow_up and severity == "critical":
                    print("    [🚀] Recon persistence — attacker progressing to exploitation wave...")
                    trigger_follow_up_wave(token, target_url, args.dry_run)
                    consecutive = 0
            print(f"\n  [⏳] Next scan in {args.interval}s...")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print(f"\n\n[⏹] Stopped after {count} scans — check Live Monitor for results!")


# ─── CLI ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SentinalIQ Nmap Recon Bridge — real nmap findings → incident response",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python nmap_bridge.py --target https://example.com          # one scan
  python nmap_bridge.py --target example.com --continuous     # re-scan every 60s
  python nmap_bridge.py --target example.com --ports "22,80,443"
  python nmap_bridge.py --target example.com --continuous --escalate --follow-up
  python nmap_bridge.py --target example.com --dry-run        # preview only
""",
    )
    parser.add_argument("--target", "-t", required=True, help="Monitored website URL or host (e.g. https://example.com)")
    parser.add_argument("--ports", "-p", default="", help="Comma-separated port list (default: top 100)")
    parser.add_argument("--top-ports", type=int, default=100, help="Number of top ports to scan (default: 100)")
    parser.add_argument("--nmap-args", default="", help="Custom nmap args replacing '-sV' + port selection (still adds -oX -)")
    parser.add_argument("--timeout", type=int, default=180, help="nmap timeout in seconds (default: 180)")
    parser.add_argument("--version-detect", "-sV", action="store_true", help="Run nmap -sV (service/version detection). Slower — use for single scans, not short continuous intervals")
    parser.add_argument("--severity", default="high", choices=["low", "medium", "high", "critical"], help="Incident severity (default: high)")
    parser.add_argument("--continuous", "-c", action="store_true", help="Keep re-scanning on an interval")
    parser.add_argument("--interval", "-i", type=int, default=60, help="Seconds between scans in continuous mode (default: 60)")
    parser.add_argument("--escalate", action="store_true", help="Escalate high→critical when scans keep finding ports")
    parser.add_argument("--follow-up", action="store_true", help="Trigger an attack wave after escalation (recon→exploitation)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be sent without calling the backend")
    parser.add_argument("--username", "-u", default="admin", help="Backend username (default: admin)")
    parser.add_argument("--password", "-pwd", default="admin123", help="Backend password (default: admin123)")
    args = parser.parse_args()

    global USERNAME, PASSWORD
    USERNAME = args.username
    PASSWORD = args.password

    # Normalize target: accept a bare host or a full URL
    target_url = args.target if "://" in args.target else "https://" + args.target
    host = urlparse(target_url).hostname or args.target

    # Fail fast if nmap isn't installed
    nmap_exe = find_nmap()
    if not nmap_exe:
        print("[✗] nmap was not found.")
        print("    Install it first — e.g.  winget install nmap  (Windows)  or  sudo apt install nmap  (Debian/Ubuntu)")
        print("    If you just installed it, open a NEW terminal (or log out/in) so the PATH refreshes.")
        sys.exit(1)
    print(f"[✓] nmap found at: {nmap_exe}")

    if args.severity in ("low", "medium"):
        print(f"[💡] Note: {args.severity.upper()} severity creates a monitor event only — use 'high' or 'critical' to also create an incident on monitored websites.")

    print("=" * 60)
    print(f"  🎯 SENTINALIQ NMAP RECON BRIDGE → {target_url}")
    print("=" * 60)
    token = authenticate(args.dry_run)

    if args.continuous:
        continuous_recon(token, target_url, host, nmap_exe, args)
        return

    # Single-shot mode
    ports = run_nmap(nmap_exe, host, args)
    if not ports:
        print("[✓] No open ports found — nothing to report to SentinalIQ.")
        sys.exit(0)
    print(f"[⚡] Found {len(ports)} open port(s) on {host}:")
    for p in ports:
        print(f"      • {p['port']}/{p['protocol']} — {p['service']}")
    print(f"[📤] Reporting to SentinalIQ as {args.severity.upper()} severity scan incident...")
    push_scan_event(token, target_url, ports, args.severity, "detected", "", args.dry_run)
    print("\n    Check Live Monitor & Incidents on the SentinalIQ dashboard!")


if __name__ == "__main__":
    main()
