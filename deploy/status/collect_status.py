#!/usr/bin/env python3
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


OUTPUT = Path("/var/www/pi-server/server-status.json")
APPS = (
    {
        "id": "home",
        "name": "Pi Home",
        "service": None,
        "static": Path("/var/www/pi-server/index.html"),
        "database": None,
        "backups": None,
    },
    {
        "id": "todo",
        "name": "Todo",
        "service": "pi-todo.service",
        "static": None,
        "database": Path("/var/lib/pi-todo/tasks.db"),
        "backups": Path("/var/backups/pi-todo"),
    },
    {
        "id": "flashcards",
        "name": "Flashcards",
        "service": "pi-flashcards.service",
        "static": None,
        "database": Path("/var/lib/pi-flashcards/flashcards.db"),
        "backups": Path("/var/backups/pi-flashcards"),
    },
    {
        "id": "geography",
        "name": "Geography",
        "service": None,
        "static": Path("/var/www/pi-server/geography/index.html"),
        "database": None,
        "backups": None,
    },
    {
        "id": "gym",
        "name": "Gym",
        "service": "pi-gym.service",
        "static": None,
        "database": Path("/var/lib/pi-gym/gym.db"),
        "backups": Path("/var/backups/pi-gym"),
    },
)


def run(*command):
    return subprocess.run(command, capture_output=True, text=True, check=False)


def is_active(unit):
    return run("systemctl", "is-active", "--quiet", unit).returncode == 0


def iso_from_epoch(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).astimezone().isoformat(timespec="seconds")


def file_info(path):
    if not path or not path.is_file():
        return None
    stat = path.stat()
    return {"updatedAt": iso_from_epoch(stat.st_mtime), "sizeBytes": stat.st_size}


def newest_backup(directory):
    if not directory or not directory.is_dir():
        return None
    files = [path for path in directory.iterdir() if path.is_file()]
    if not files:
        return None
    newest = max(files, key=lambda path: path.stat().st_mtime)
    info = file_info(newest)
    return {"createdAt": info["updatedAt"], "sizeBytes": info["sizeBytes"], "count": len(files)}


def systemd_timestamp(unit, property_name):
    result = run("systemctl", "show", unit, f"--property={property_name}", "--value")
    value = result.stdout.strip()
    if result.returncode or not value or value == "n/a":
        return None
    parsed = run("date", "--date", value, "+%s")
    if parsed.returncode:
        return None
    return iso_from_epoch(int(parsed.stdout.strip()))


def last_deploy_attempt(unit):
    result = run(
        "journalctl", "--unit", unit, "--grep", "A new successful", "--reverse",
        "--lines", "1", "--output", "short-unix", "--no-pager",
    )
    match = re.match(r"^(\d+(?:\.\d+)?)", result.stdout.strip())
    return iso_from_epoch(float(match.group(1))) if match else None


def memory_used_percent():
    values = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        key, value = line.split(":", 1)
        values[key] = int(value.strip().split()[0])
    return round((1 - values["MemAvailable"] / values["MemTotal"]) * 100)


def temperature_celsius():
    path = Path("/sys/class/thermal/thermal_zone0/temp")
    return round(int(path.read_text().strip()) / 1000, 1) if path.is_file() else None


def app_status(config):
    app_id = config["id"]
    marker = Path(f"/var/lib/pi-{app_id}/last-deployed-sha")
    deployed = file_info(marker)
    service_healthy = is_active(config["service"]) if config["service"] else config["static"].is_file()
    updates_active = is_active(f"pi-{app_id}-update.timer")
    sha = marker.read_text().strip()[:7] if marker.is_file() else None
    return {
        "id": app_id,
        "name": config["name"],
        "healthy": service_healthy and updates_active,
        "serviceActive": service_healthy,
        "updatesActive": updates_active,
        "lastCheck": systemd_timestamp(f"pi-{app_id}-update.service", "ExecMainStartTimestamp"),
        "lastDeployAttempt": last_deploy_attempt(f"pi-{app_id}-update.service"),
        "lastDeployment": deployed["updatedAt"] if deployed else None,
        "deployedSha": sha,
        "database": file_info(config["database"]),
        "backup": newest_backup(config["backups"]),
    }


def build_status():
    disk = shutil.disk_usage("/")
    apps = [app_status(config) for config in APPS]
    nginx_active = is_active("nginx.service")
    memory_percent = memory_used_percent()
    disk_percent = round(disk.used / disk.total * 100)
    temperature = temperature_celsius()
    healthy = (
        nginx_active
        and all(app["healthy"] for app in apps)
        and disk_percent < 90
        and (temperature is None or temperature < 80)
    )
    return {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "server": {
            "healthy": healthy,
            "nginxActive": nginx_active,
            "uptimeSeconds": int(float(Path("/proc/uptime").read_text().split()[0])),
            "temperatureC": temperature,
            "memoryUsedPercent": memory_percent,
            "diskUsedPercent": disk_percent,
        },
        "apps": apps,
    }


def write_status(status):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".server-status-", dir=OUTPUT.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as temporary:
            json.dump(status, temporary, ensure_ascii=False, separators=(",", ":"))
            temporary.write("\n")
        os.chmod(temporary_name, 0o644)
        os.replace(temporary_name, OUTPUT)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


if __name__ == "__main__":
    write_status(build_status())
