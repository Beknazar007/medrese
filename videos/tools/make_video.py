"""Records a narrated how-to video from a scenario file: Playwright screen capture → edge-tts → ffmpeg.

    python videos/tools/make_video.py videos/scenarios/login.md                # ky + ru, every role
    python videos/tools/make_video.py videos/scenarios/login.md --lang ru --role teacher

Starts its own stand (backend on a fresh SQLite database with made-up people + Vite dev server)
unless --base-url is given. Never point --base-url at production: the video shows real names.
Output: videos/output/<feature>/<role>-<lang>.mp4 / .srt, frames/ for a visual check, manifest.json.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).resolve().parent
LOCALES = ROOT / "frontend" / "src" / "i18n" / "locales"
RELIGIOUS_MARK = "ТРЕБУЕТ ПРОВЕРКИ УСТАЗОМ"
DEVICES = {"mobile": {"width": 390, "height": 844}, "desktop": {"width": 1280, "height": 800}}
# Breathing room so a line never starts on the very first frame or gets cut at the end.
LEAD_IN_S, TAIL_S, AFTER_LINE_S = 0.8, 1.5, 0.4


# ---------------------------------------------------------------- scenario file


@dataclass
class Scenario:
    feature: str
    role: str
    device: str
    steps: list[dict]
    lines: dict[str, dict[str, str]]  # key -> {lang: text}
    religious: bool
    source: Path
    sha256: str


def parse_scenarios(path: Path) -> list[Scenario]:
    text = path.read_text(encoding="utf-8")
    header = dict(re.findall(r"(\w+):\s*([\w.\-]+)", text.split("\n## ", 1)[0]))
    feature = header.get("feature") or path.stem
    lines = _parse_voice_table(text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()

    # One file may hold several roles: "## Сценарий: teacher" sections, each with its own steps.
    sections = re.split(r"^## Сценарий:\s*(\w+)\s*$", text, flags=re.M)
    if len(sections) == 1:
        chunks = [(header.get("role", "teacher"), text)]
    else:
        chunks = list(zip(sections[1::2], sections[2::2]))

    result = []
    for role, chunk in chunks:
        m = re.search(r"```yaml\n(.*?)```", chunk, flags=re.S)
        if not m:
            sys.exit(f"{path}: no ```yaml steps block for role {role}")
        steps = yaml.safe_load(m.group(1)) or []
        for step in steps:
            key = step.get("say")
            if key and key not in lines:
                sys.exit(f"{path}: step {step.get('id')} says '{key}', but there is no such row in «Озвучка»")
        device = re.search(r"device:\s*(\w+)", chunk)
        result.append(
            Scenario(
                feature=feature,
                role=role,
                device=(device.group(1) if device else header.get("device", "mobile")),
                steps=steps,
                lines=lines,
                religious=RELIGIOUS_MARK in text,
                source=path,
                sha256=sha,
            )
        )
    return result


def _parse_voice_table(text: str) -> dict[str, dict[str, str]]:
    part = text.split("## Озвучка", 1)
    if len(part) < 2:
        return {}
    rows = [r for r in part[1].splitlines() if r.strip().startswith("|")]
    if not rows:
        return {}
    head = [c.strip() for c in rows[0].strip("|").split("|")]
    langs = [re.match(r"(\w+)", h).group(1) for h in head[1:]]  # "ky (кыргызча)" -> "ky"
    table = {}
    for row in rows[2:]:  # skip header and |---|
        cells = [c.strip() for c in row.strip().strip("|").split("|")]
        if cells and cells[0]:
            table[cells[0]] = {lang: cell.replace(f"⚠ {RELIGIOUS_MARK}", "").strip() for lang, cell in zip(langs, cells[1:])}
    return table


# ---------------------------------------------------------------- helpers


def ffmpeg_bins() -> tuple[str, str]:
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if ffmpeg and ffprobe:
        return ffmpeg, ffprobe
    import static_ffmpeg.run  # downloads a pinned build on first use

    return static_ffmpeg.run.get_or_fetch_platform_executables_else_raise()


def duration(ffprobe: str, path: Path) -> float:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def i18n(lang: str) -> dict:
    return json.loads((LOCALES / f"{lang}.json").read_text(encoding="utf-8"))


def resolve(value, strings: dict):
    """`@login.submit` in a target or value → that UI text in the video's language."""
    if not isinstance(value, str):
        return value

    def lookup(m: re.Match) -> str:
        node = strings
        for part in m.group(1).split("."):
            node = node[part]
        return node

    return re.sub(r"@([a-z_]+(?:\.[a-z_0-9]+)+)", lookup, value)


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


# ---------------------------------------------------------------- stand


@dataclass
class Stand:
    backend_port: str = "8767"
    frontend_port: str = "5177"
    procs: list[subprocess.Popen] = field(default_factory=list)

    @property
    def url(self) -> str:
        return f"http://localhost:{self.frontend_port}"

    def start(self) -> None:
        env = {**os.environ, "E2E_BACKEND_PORT": self.backend_port, "E2E_FRONTEND_PORT": self.frontend_port}
        python = os.environ.get("PYTHON", "python" if os.name == "nt" else "python3")
        log = open(ROOT / "e2e" / ".stand" / "video-stand.log", "w", encoding="utf-8") if (ROOT / "e2e" / ".stand").exists() else subprocess.DEVNULL
        self.procs.append(subprocess.Popen([python, str(ROOT / "e2e" / "fixtures" / "start_backend.py")], env=env, stdout=log, stderr=log))
        npm = shutil.which("npm") or "npm"
        fe_env = {**env, "VITE_API_BASE_URL": f"http://127.0.0.1:{self.backend_port}/api/v1"}
        self.procs.append(
            subprocess.Popen([npm, "--prefix", str(ROOT / "frontend"), "run", "dev", "--", "--port", self.frontend_port, "--strictPort"],
                             env=fe_env, stdout=log, stderr=log)
        )
        self._wait(f"http://127.0.0.1:{self.backend_port}/health")
        self._wait(self.url)

    def _wait(self, url: str, timeout: float = 120) -> None:
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            try:
                urllib.request.urlopen(url, timeout=2)
                return
            except Exception:
                if any(p.poll() is not None for p in self.procs):
                    self.stop()
                    sys.exit("stand process exited early — see e2e/.stand/video-stand.log")
                time.sleep(0.5)
        self.stop()
        sys.exit(f"stand did not answer at {url}")

    def stop(self) -> None:
        for p in self.procs:
            if p.poll() is None:
                if os.name == "nt":  # npm spawns node: kill the whole tree
                    subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True)
                else:
                    p.terminate()
        self.procs.clear()


# ---------------------------------------------------------------- pipeline


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)", line)
            if m and m.group(1) not in env:
                env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return env


def pick_voice(lang: str, voices: dict, env: dict) -> dict:
    """ElevenLabs when it is configured for this language and a key is in .env, otherwise edge-tts."""
    cfg = voices[lang]
    eleven = cfg.get("elevenlabs") or {}
    if eleven.get("voice_id") and env.get("ELEVENLABS_API_KEY"):
        return {"provider": "elevenlabs", "name": f"elevenlabs:{eleven['model']}:{eleven['voice_id']}", **eleven,
                "api_key": env["ELEVENLABS_API_KEY"], "lang": lang}
    return {"provider": "edge", "name": cfg["voice"], "voice": cfg["voice"], "note": cfg.get("note")}


def elevenlabs_tts(text: str, voice: dict, path: Path) -> None:
    body = {"text": text, "model_id": voice["model"]}
    if voice.get("language_code"):
        body["language_code"] = voice["language_code"]
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": voice["api_key"], "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs {e.code}: {e.read().decode(errors='replace')[:300]}")


async def synthesize(lines: dict[str, str], voice: dict, out_dir: Path) -> dict[str, Path]:
    paths = {}
    for key, text in lines.items():
        path = out_dir / f"{key}.mp3"
        if voice["provider"] == "elevenlabs":
            elevenlabs_tts(text, voice, path)
        else:
            import edge_tts

            await edge_tts.Communicate(text, voice["voice"]).save(str(path))
        paths[key] = path
    return paths


def spotlight(locator) -> None:
    # Headless video has no mouse pointer — outline the element so the viewer sees where to tap.
    locator.evaluate(
        """el => { const o = el.style.outline; el.style.outline = '3px solid #f5a623';
                    el.style.outlineOffset = '2px'; setTimeout(() => { el.style.outline = o; }, 900); }"""
    )


def locate(page, target: str):
    if target.startswith("label="):
        return page.get_by_label(target[6:]).first
    m = re.fullmatch(r'role=(\w+)\[name="(.+)"\]', target)
    if m:
        return page.get_by_role(m.group(1), name=m.group(2)).first
    return page.locator(target).first  # text=…, css, etc.


def record(sc: Scenario, lang: str, base_url: str, clips: dict[str, Path], clip_len: dict[str, float], work: Path):
    from playwright.sync_api import sync_playwright

    strings = i18n(lang)
    size = DEVICES.get(sc.device, DEVICES["mobile"])
    cues = []  # (start, end, key)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport=size, record_video_dir=str(work), record_video_size=size,
            is_mobile=sc.device == "mobile", has_touch=sc.device == "mobile", locale="ru-RU",
        )
        ctx.add_init_script(f"localStorage.setItem('i18nextLng', '{lang}')")
        page = ctx.new_page()
        t0 = time.monotonic()  # the video starts with the page
        page.goto(base_url + "/login")  # neutral first frame while the lead-in plays
        page.wait_for_load_state("networkidle")
        time.sleep(LEAD_IN_S)

        for step in sc.steps:
            started = time.monotonic()
            key = step.get("say")
            if key:
                cues.append((started - t0, started - t0 + clip_len[key], key))
            action, target, value = step["action"], resolve(step.get("target"), strings), resolve(step.get("value"), strings)
            if action == "login":  # quick, off-topic part of most videos: log in as a stand account
                page.goto(base_url + "/login")
                page.get_by_label(strings["login"]["username"]).fill(str(value))
                page.get_by_label(strings["login"]["password"]).fill("password")
                page.get_by_role("button", name=strings["login"]["submit"]).click()
                page.wait_for_load_state("networkidle")
            elif action == "goto":
                page.goto(base_url + target if target.startswith("/") else target)
                page.wait_for_load_state("networkidle")
            elif action == "click":
                loc = locate(page, target)
                spotlight(loc)
                time.sleep(0.5)
                loc.click()
            elif action == "fill":
                loc = locate(page, target)
                spotlight(loc)
                loc.click()
                loc.press_sequentially(str(value), delay=90)  # typed letter by letter, like a person
            elif action == "select":
                locate(page, target).select_option(str(value))
            elif action == "highlight":
                spotlight(locate(page, target))
            elif action == "wait":
                if target and target.startswith("/"):
                    page.wait_for_url(f"**{target}", timeout=15000)
                elif target:
                    locate(page, target).wait_for(timeout=15000)
            else:
                raise SystemExit(f"step {step.get('id')}: unknown action '{action}'")
            # Hold the step until the line is spoken and the viewer has had `pause` seconds.
            hold = max(float(step.get("pause", 1.0)), (clip_len[key] + AFTER_LINE_S) if key else 0)
            left = hold - (time.monotonic() - started)
            if left > 0:
                time.sleep(left)

        time.sleep(TAIL_S)
        video = Path(page.video.path())
        ctx.close()
        browser.close()
    return video, cues


def mix(ffmpeg: str, video: Path, cues, clips: dict[str, Path], srt: Path, out: Path) -> None:
    args = [ffmpeg, "-y", "-loglevel", "error", "-i", str(video)]
    for _, _, key in cues:
        args += ["-i", str(clips[key])]
    args += ["-i", str(srt)]
    parts = [f"[{i + 1}:a]adelay={int(start * 1000)}:all=1[a{i}]" for i, (start, _, _) in enumerate(cues)]
    parts.append("".join(f"[a{i}]" for i in range(len(cues))) + f"amix=inputs={len(cues)}:normalize=0[aout]")
    args += [
        "-filter_complex", ";".join(parts),
        "-map", "0:v", "-map", "[aout]", "-map", f"{len(cues) + 1}:s",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k", "-c:s", "mov_text", "-metadata:s:s:0", "language=" + ("kir" if "-ky" in out.stem else "rus"),
        "-movflags", "+faststart", str(out),
    ]
    subprocess.run(args, check=True)


def frames(ffmpeg: str, video: Path, length: float, out_dir: Path) -> list[str]:
    out_dir.mkdir(exist_ok=True)
    names = []
    for label, at in (("start", 0.1), ("middle", 0.5), ("end", 0.9)):
        path = out_dir / f"{video.stem}-{label}.png"
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-ss", f"{length * at:.2f}", "-i", str(video), "-frames:v", "1", str(path)], check=True)
        names.append(str(path.relative_to(ROOT).as_posix()))
    return names


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scenario", type=Path)
    ap.add_argument("--lang", default="ky,ru")
    ap.add_argument("--role", help="only this role from the scenario file")
    ap.add_argument("--base-url", help="use an already running local stand instead of starting one")
    args = ap.parse_args()

    if args.base_url and not re.match(r"https?://(localhost|127\.0\.0\.1)(:\d+)?", args.base_url):
        sys.exit("--base-url must be a local stand (localhost) — production shows real students")

    voices = json.loads((TOOLS / "voices.json").read_text(encoding="utf-8"))
    env = load_env()
    ffmpeg, ffprobe = ffmpeg_bins()
    scenarios = [s for s in parse_scenarios(args.scenario.resolve()) if not args.role or s.role == args.role]
    if not scenarios:
        sys.exit("no scenario matches --role")
    langs = [lang.strip() for lang in args.lang.split(",") if lang.strip()]
    app_version = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))["version"]

    feature = scenarios[0].feature
    out_dir = ROOT / "videos" / "output" / feature
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"feature": feature, "videos": []}

    stand = None
    base_url = args.base_url
    if not base_url:
        (ROOT / "e2e" / ".stand").mkdir(parents=True, exist_ok=True)
        stand = Stand()
        print("starting the local stand …")
        stand.start()
        base_url = stand.url
    try:
        for sc in scenarios:
            for lang in langs:
                vid = f"{sc.feature}-{sc.role}-{lang}"
                print(f"→ {vid}")
                with tempfile.TemporaryDirectory() as tmp:
                    work = Path(tmp)
                    texts = {k: v[lang] for k, v in sc.lines.items() if v.get(lang)}
                    missing = [s["say"] for s in sc.steps if s.get("say") and s["say"] not in texts]
                    if missing:
                        sys.exit(f"{vid}: no {lang} text for {missing}")
                    voice = pick_voice(lang, voices, env)
                    clips = asyncio.run(synthesize(texts, voice, work))
                    clip_len = {k: duration(ffprobe, p) for k, p in clips.items()}
                    raw, cues = record(sc, lang, base_url, clips, clip_len, work)

                    srt = out_dir / f"{sc.role}-{lang}.srt"
                    srt.write_text(
                        "\n".join(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{texts[k]}\n" for i, (a, b, k) in enumerate(cues, 1)),
                        encoding="utf-8",
                    )
                    mp4 = out_dir / f"{sc.role}-{lang}.mp4"
                    mix(ffmpeg, raw, cues, clips, srt, mp4)

                length = duration(ffprobe, mp4)
                entry = {
                    "id": vid,
                    "feature": sc.feature,
                    "role": sc.role,
                    "lang": lang,
                    "device": sc.device,
                    "file": mp4.relative_to(ROOT).as_posix(),
                    "subtitles": srt.relative_to(ROOT).as_posix(),
                    "duration_s": round(length, 1),
                    "voice": voice["name"],
                    "voice_note": voice.get("note"),
                    "scenario": sc.source.relative_to(ROOT).as_posix(),
                    "scenario_hash": sc.sha256,
                    "app_version": app_version,
                    "religious_review": "required" if sc.religious else "not_needed",
                    "native_speaker_review": "required" if lang == "ky" else "not_needed",
                    "frames": frames(ffmpeg, mp4, length, out_dir / "frames"),
                    "created_at": datetime.now(ZoneInfo("Asia/Bishkek")).isoformat(timespec="seconds"),
                }
                manifest["videos"] = [v for v in manifest["videos"] if v["id"] != vid] + [entry]
                manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                print(f"  {entry['file']} — {entry['duration_s']} s, {len(cues)} lines, voice {voice['name']}")
    finally:
        if stand:
            stand.stop()


if __name__ == "__main__":
    main()
