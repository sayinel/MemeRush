import json
from datetime import datetime, timezone
from pathlib import Path

from discovery import cli
from discovery.pipeline import make_sim_fetch, run_pipeline
from discovery.sources.file_source import FileSource

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)


def _run():
    sigs = FileSource(FX / "signals.json").collect()
    return run_pipeline(sigs, make_sim_fetch(sigs), now=NOW)


def test_fixture_has_10_signals():
    assert len(FileSource(FX / "signals.json").collect()) == 10


def test_top5_matches_expected_rank():
    exp = json.loads((FX / "expected_rank.json").read_text(encoding="utf-8"))
    cands, _ = _run()
    assert [c.name for c in cands] == exp["top5"]
    assert [c.rank for c in cands] == [1, 2, 3, 4, 5]


def test_rejections_have_reasons():
    exp = json.loads((FX / "expected_rank.json").read_text(encoding="utf-8"))
    _, rej = _run()
    got = {r["name"]: " ".join(r["reasons"]) for r in rej}
    assert set(got) == set(exp["rejected"])
    for name, word in exp["rejected"].items():
        assert word in got[name], (name, got[name])


def test_card_fields_and_risks():
    cands, _ = _run()
    d = cands[0].to_dict()
    assert set(d) >= {"rank", "name", "score", "rule_one_line", "session_length", "controls",
                      "score_type", "new_skin", "ip_risks", "link_status", "evidence_url", "picked",
                      "online", "community", "fading", "astroturf_suspect", "popularity_total",
                      "popularity_scores", "consensus", "link_info", "meme_context", "background_line"}
    assert d["rule_one_line"].endswith("10.00초에 맞춰 탭한다")
    assert d["ip_risks"]


def test_cli_run_and_pick(tmp_path):
    out = tmp_path / "out"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out),
                     "--now", NOW.isoformat()]) == 0
    assert len(json.loads((out / "candidates.json").read_text(encoding="utf-8"))) == 5
    assert (out / "CANDIDATES.md").read_text(encoding="utf-8").startswith("# 오늘의 게임 후보")
    assert (out / "TODAY.md").exists() and (out / "MEMES.md").exists()
    assert cli.main(["pick", "--name", "게이지 낚시", "--out", str(out)]) == 0
    assert cli.main(["pick", "--name", "없는 게임", "--out", str(out)]) == 1
    lines = (out / "picks.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1 and json.loads(lines[0])["name"] == "게이지 낚시"
