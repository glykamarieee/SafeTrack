# Writes one test file per test case: __tests__/cases/<folder>/<ID>.test.ts(x).
# Each file holds that case's real test, unchanged, plus the same imports, helpers and hooks as
# its source file. When the case needs earlier cases first (state they create), those earlier
# tests run as setup steps in a beforeAll, so the run reports exactly one test: "1 passed, 1 total".
# usage: python gen_cases.py            (all)   |   python gen_cases.py --all-prior CASE-051 ...
import re, sys
from pathlib import Path

APP = Path(__file__).resolve().parents[2]
T = APP / "__tests__"
OUT = T / "cases"

SOURCES = ["auth/login.test.tsx", "auth/password-recovery.test.tsx", "auth/register.test.tsx",
           "auth/welcome-guide.test.tsx", "places/password-rule.test.ts", "geofencing/anomaly-notices.test.tsx",
           "geofencing/safe-zones.test.tsx", "geofencing/safety-records.test.tsx",
           "geofencing/zone-detection.test.ts", "sos/sos-flow.test.tsx",
           "integration/accounts.int.test.ts", "integration/devices.int.test.ts", "integration/safety.int.test.ts"]

# Earlier cases a case needs (state they create). "ALL" = every earlier test of the file, in order.
DEPS = {
    "CASE-012": ["CASE-011"],
    "CASE-046": ["CASE-039"], "CASE-048": ["CASE-039", "CASE-046"], "CASE-049": ["CASE-039", "CASE-046"],
    "CASE-050": ["CASE-039", "CASE-046"], "CASE-051": ["CASE-039", "CASE-046", "CASE-049"],
    "CASE-052": ["CASE-039", "CASE-046"], "CASE-054": ["CASE-039", "CASE-046"], "CASE-053": ["CASE-039", "CASE-046"],
    "CASE-056": ["CASE-055"],
    "CASE-082": ["CASE-087"], "CASE-094": ["CASE-087"], "CASE-095": ["CASE-087"], "CASE-096": ["CASE-087"],
    "CASE-103": ["CASE-087"], "CASE-100": ["CASE-087"], "CASE-098": ["CASE-087"], "CASE-099": ["CASE-087", "CASE-098"],
    "CASE-106": ["CASE-087"], "CASE-107": ["CASE-087"],
    "INT-007": ["INT-006"], "INT-008": ["INT-006", "INT-007"], "INT-009": ["INT-006", "INT-007", "INT-008"],
    "INT-043": ["INT-006", "INT-007", "INT-008"], "INT-042": ["INT-006", "INT-007", "INT-008"],
    "INT-033": ["INT-010"],
    "INT-030": ["INT-014"], "INT-021": ["INT-018"], "INT-019": ["INT-018"], "INT-031": ["INT-018"],
    "INT-034": ["INT-018"],
}

TEST_RE = re.compile(r'^(\s*)(test|it)\((["`])((?:CASE|INT)-\d+)[:\s]')
HOOK_RE = re.compile(r'^(\s*)(beforeAll|afterAll|beforeEach|afterEach)\(')


def block_end(lines, i):
    """Index of the last line of the call starting at lines[i] (prettier style: closes at the same indent)."""
    line = lines[i]
    if line.count("(") <= line.count(")") and line.rstrip().endswith(";"):
        return i
    indent = re.match(r"\s*", line).group(0)
    j = i + 1
    while j < len(lines) and not (lines[j].startswith(indent + "}") and not lines[j].startswith(indent + " ")):
        j += 1
    return j


def parse(path):
    lines = path.read_text(encoding="utf8").split("\n")
    header, describes, i = [], [], 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("describe("):
            end = block_end(lines, i)
            body = lines[i + 1:end]
            d = {"open": line, "close": lines[end], "items": []}
            k = 0
            while k < len(body):
                m, h = TEST_RE.match(body[k]), HOOK_RE.match(body[k])
                if m or h:
                    e = block_end(body, k)
                    d["items"].append({"kind": "test" if m else h.group(2), "id": m.group(4) if m else None,
                                       "lines": body[k:e + 1]})
                    k = e + 1
                else:
                    d["items"].append({"kind": "other", "lines": [body[k]]})
                    k += 1
            describes.append(d)
            i = end + 1
        else:
            header.append(line)
            i += 1
    return header, describes


def as_call(block, indent="    "):
    """A test or hook block turned into an awaited call (its body runs as a setup step)."""
    first, *rest = block
    if TEST_RE.match(first):
        first = re.sub(r'^\s*(test|it)\((["`]).*?\2,\s*', "await (", first)
    else:
        first = re.sub(r'^\s*(beforeAll|afterAll|beforeEach|afterEach)\(', "await (", first)
    text = "\n".join([first] + rest)
    text = re.sub(r"\}\s*(,\s*[\d_]+\s*)?\);\s*$", "})();", text.rstrip()) if rest else re.sub(r"\);\s*$", ")();", text.rstrip())
    # A setup test ends like a finished test: its screen is closed (as Jest does after each test).
    if TEST_RE.match(block[0]):
        text += '\n    await require("@testing-library/react-native").cleanup();'
        text += '\n    jest.clearAllMocks();'
    return text


def build(src, header, describes, di, ti, deps):
    d = describes[di]
    target = d["items"][ti]
    out = list(header)
    out.append(d["open"])
    others = [it for it in d["items"] if it["kind"] == "other"]
    hooks = [it for it in d["items"] if it["kind"] in ("beforeAll", "afterAll", "beforeEach", "afterEach")]
    for it in others:
        out += it["lines"]
    # Setup from earlier describe blocks (their hooks around their tests), when needed.
    earlier = []
    for dj in describes[:di]:
        tests = [it for it in dj["items"] if it["kind"] == "test" and (deps == "ALL" or it["id"] in deps)]
        if not tests:
            continue
        step = ["    await (async () => {"]
        step += ["      " + l for it in dj["items"] if it["kind"] == "other" for l in it["lines"]]
        for it in dj["items"]:
            if it["kind"] == "beforeAll":
                step.append(as_call(it["lines"]))
        for it in tests:
            step.append(as_call(it["lines"]))
        for it in dj["items"]:
            if it["kind"] == "afterAll":
                step.append(as_call(it["lines"]))
        step.append("    })();")
        earlier += step
    if earlier:
        out.append("  // Setup: earlier cases this case builds on, run as steps (not counted as tests).")
        out.append("  beforeAll(async () => {")
        out += earlier
        out.append("  }, 900_000);")
    for it in hooks:
        out += it["lines"]
    prior = [it for it in d["items"][:ti] if it["kind"] == "test" and (deps == "ALL" or it["id"] in deps)]
    if prior:
        out.append("  // Setup: earlier cases this case builds on, run as steps (not counted as tests).")
        out.append("  beforeAll(async () => {")
        for it in prior:
            out.append(as_call(it["lines"]))
        out.append("  }, 900_000);")
    out += target["lines"]
    out.append(d["close"])
    return "\n".join(out) + "\n"


def main():
    args = sys.argv[1:]
    all_prior = set()
    if args and args[0] == "--all-prior":
        all_prior = set(args[1:])
    only = set(args[1:]) if args and args[0] == "--only" else None
    made = 0
    for rel in SOURCES:
        src = T / rel
        header, describes = parse(src)
        folder, name = rel.split("/")
        ext = ".test.tsx" if name.endswith(".tsx") else ".test.ts"
        for di, d in enumerate(describes):
            for ti, it in enumerate(d["items"]):
                if it["kind"] != "test":
                    continue
                cid = it["id"]
                if only is not None and cid not in only:
                    continue
                if all_prior and cid not in all_prior:
                    continue
                deps = "ALL" if cid in all_prior else DEPS.get(cid, [])
                text = build(src, header, describes, di, ti, deps)
                dest = T / folder / f"{cid}{ext}"
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(text, encoding="utf8", newline="\n")
                made += 1
    print("written", made)


if __name__ == "__main__":
    main()
