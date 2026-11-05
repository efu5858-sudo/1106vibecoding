"""강사용: 저장소를 pull 하고 라운드별 제출 현황을 dashboard.json 으로 정리한다.

사용법 (저장소 맨 위 폴더에서):
    python _instructor/collect.py            # git pull 후 정리
    python _instructor/collect.py --no-pull  # 지금 있는 파일로만 정리

결과: _instructor/out/dashboard.json, _instructor/out/screenshots/<라운드>/<아이디>.png
"""

import argparse
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_instructor" / "out"
ROUNDS = ["round1", "round2", "round3"]
EXAMPLES_DIR = "[강사예시]"
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".txt"}
SCREENSHOT_NAMES = {"screenshot.png", "screenshot.jpg", "screenshot.jpeg"}
IGNORED_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}

# 공개 저장소에 올라오면 안 되는 값처럼 보이는 문자열
SECRET_PATTERNS = [
    (re.compile(r"AIza[0-9A-Za-z_\-]{30,}"), "Google API 키"),
    (re.compile(r"sk-[0-9A-Za-z_\-]{20,}"), "OpenAI 계열 키"),
    (re.compile(r"gh[pousr]_[0-9A-Za-z]{30,}"), "깃허브 토큰"),
    (re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b"), "휴대폰 번호"),
]


def git(*args):
    result = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8"
    )
    return result.stdout.strip()


def last_commit(path):
    line = git("log", "-1", "--format=%cI|%an|%s", "--", str(path.relative_to(ROOT)))
    if not line:
        return None
    time, author, message = line.split("|", 2)
    return {"time": time, "author": author, "message": message}


def read_text(path):
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def collect_files(folder):
    files = {}
    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.name in IGNORED_NAMES:
            continue
        rel = path.relative_to(folder).as_posix()
        info = {"bytes": path.stat().st_size}
        if path.suffix.lower() in TEXT_EXT:
            text = read_text(path)
            if text is not None:
                info["lines"] = text.count("\n") + 1
        files[rel] = info
    return files


def read_manifest(folder, files):
    issues = []
    if "manifest.json" in files:
        manifest_path = folder / "manifest.json"
    else:
        nested = [p for p in files if p.endswith("/manifest.json")]
        if not nested:
            return None, ["manifest.json 없음"]
        manifest_path = folder / nested[0]
        issues.append(f"manifest.json 이 한 단계 안쪽에 있음 ({nested[0]})")
    try:
        manifest = json.loads(read_text(manifest_path) or "")
    except json.JSONDecodeError:
        return None, issues + ["manifest.json 을 읽을 수 없음"]

    matches = sorted(
        {m for cs in manifest.get("content_scripts", []) for m in cs.get("matches", [])}
    )
    return {
        "name": manifest.get("name"),
        "description": manifest.get("description"),
        "version": manifest.get("version"),
        "permissions": manifest.get("permissions", []),
        "host_permissions": manifest.get("host_permissions", []),
        "content_script_sites": matches,
    }, issues


def scan_secrets(folder, files):
    found = []
    for rel in files:
        if Path(rel).suffix.lower() not in TEXT_EXT:
            continue
        text = read_text(folder / rel) or ""
        for pattern, label in SECRET_PATTERNS:
            if pattern.search(text):
                found.append(f"{rel}: {label}처럼 보이는 값")
    return found


def compare(prev_files, files):
    added = [f for f in files if f not in prev_files]
    removed = [f for f in prev_files if f not in files]
    changed = []
    for f in files:
        if f in prev_files and files[f] != prev_files[f]:
            delta = files[f].get("lines", 0) - prev_files[f].get("lines", 0)
            changed.append({"file": f, "line_delta": delta})
    return {"added": added, "removed": removed, "changed": changed}


def collect_round(round_name, prev_round_files):
    round_dir = ROOT / round_name
    submissions = {}
    stray = []
    if not round_dir.exists():
        return submissions, stray

    for entry in sorted(round_dir.iterdir()):
        if entry.is_file():
            if entry.name != "README.md" and entry.name not in IGNORED_NAMES:
                stray.append(entry.name)
            continue
        if entry.name.startswith((".", "_")):
            continue

        student = entry.name
        files = collect_files(entry)
        manifest, issues = read_manifest(entry, files)
        screenshot = next((f for f in files if f.lower() in SCREENSHOT_NAMES), None)
        if not screenshot:
            issues.append("screenshot.png 없음")
        else:
            dest = OUT / "screenshots" / round_name / f"{student}{Path(screenshot).suffix.lower()}"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(entry / screenshot, dest)
            screenshot = dest.relative_to(OUT).as_posix()

        submission = {
            "manifest": manifest,
            "screenshot": screenshot,
            "files": files,
            "total_lines": sum(f.get("lines", 0) for f in files.values()),
            "last_commit": last_commit(entry),
            "issues": issues,
            "secret_warnings": scan_secrets(entry, files),
        }
        if student in prev_round_files:
            submission["changes_from_previous_round"] = compare(
                prev_round_files[student], files
            )
        submissions[student] = submission

    return submissions, stray


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-pull", action="store_true", help="git pull 을 건너뜀")
    args = parser.parse_args()

    if not args.no_pull:
        print(git("pull", "--ff-only") or "git pull 완료")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    rounds = {}
    prev_files = {}
    for round_name in ROUNDS:
        submissions, stray = collect_round(round_name, prev_files)
        rounds[round_name] = {
            "submitted": len(submissions),
            "stray_files": stray,
            "submissions": submissions,
        }
        prev_files = {s: sub["files"] for s, sub in submissions.items()}

    examples, _ = collect_round(EXAMPLES_DIR, {})

    students = sorted({s for r in rounds.values() for s in r["submissions"]})
    dashboard = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commit": git("rev-parse", "--short", "HEAD"),
        "students": students,
        "rounds": rounds,
        "examples": examples,
    }
    out_file = OUT / "dashboard.json"
    out_file.write_text(json.dumps(dashboard, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"학생 {len(students)}명")
    for round_name, r in rounds.items():
        print(f"  {round_name}: {r['submitted']}명 제출", end="")
        if r["stray_files"]:
            print(f"  (폴더 밖에 흩어진 파일 {len(r['stray_files'])}개)", end="")
        print()
        for student, sub in r["submissions"].items():
            for problem in sub["issues"] + sub["secret_warnings"]:
                print(f"    ! {student}: {problem}")
    print(f"저장: {out_file}")


if __name__ == "__main__":
    main()
