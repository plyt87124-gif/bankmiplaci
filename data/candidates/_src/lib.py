"""Helpers for building promotion candidate JSON files (checklist steps etc.)."""
import json


def month_label(m: int) -> str:
    return "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"


def open_steps(titles, label="Otwarcie konta", start=0, reward=None, available_until=None):
    """Group 0 steps. reward = (title, cents) appended as a reward row."""
    out = []
    o = start
    for t in titles:
        s = {"order": o, "monthLabel": label, "title": t}
        if available_until:
            s["availableUntil"] = available_until
        out.append(s)
        o += 1
    if reward:
        s = {"order": o, "monthLabel": label, "title": reward[0], "rewardCents": reward[1]}
        if available_until:
            s["availableUntil"] = available_until
        out.append(s)
    return out


def month_steps(months, titles, reward_title, reward_cents, available_until=None):
    """For each month number in `months`: action steps then one reward step."""
    out = []
    for m in months:
        base = m * 10
        for i, t in enumerate(titles):
            s = {"order": base + i, "monthLabel": month_label(m), "title": t}
            if available_until:
                s["availableUntil"] = available_until
            out.append(s)
        r = {"order": base + len(titles), "monthLabel": month_label(m), "title": reward_title, "rewardCents": reward_cents}
        if available_until:
            r["availableUntil"] = available_until
        out.append(r)
    return out


def total_rewards(steps):
    return sum(s.get("rewardCents", 0) for s in steps)


def merge_rewards(steps):
    """The ściąga UI shows ONE reward row per month group (the first one) and counts only
    that one. Several reward rows in a group would be lost, so merge them into a single row
    carrying the summed amount and a combined title."""
    import re
    groups = {}
    for s in steps:
        groups.setdefault(s["order"] // 10, []).append(s)
    out = []
    for g in sorted(groups):
        rows = groups[g]
        rewards = [r for r in rows if r.get("rewardCents") is not None]
        if len(rewards) <= 1:
            out += rows
            continue
        actions = [r for r in rows if r.get("rewardCents") is None]
        parts = [re.sub(r"^Odbierz\s+(nagrodę|premię|bonus|zwrot|zwroty)?\s*:?\s*", "", r["title"]).strip() for r in rewards]
        avail = {r.get("availableUntil") for r in rewards}
        merged = dict(rewards[0])
        merged["title"] = "Odbierz nagrody: " + " + ".join(parts)
        merged["rewardCents"] = sum(r["rewardCents"] for r in rewards)
        merged["order"] = max(r["order"] for r in rewards)
        if len(avail) == 1 and None not in avail:
            merged["availableUntil"] = avail.pop()
        else:
            merged.pop("availableUntil", None)
        out += actions + [merged]
    return out


def write(path, data):
    data["checklistSteps"] = merge_rewards(data["checklistSteps"])
    per_group = {}
    for st in data["checklistSteps"]:
        if st.get("rewardCents") is not None:
            per_group[st["order"] // 10] = per_group.get(st["order"] // 10, 0) + 1
    assert all(v == 1 for v in per_group.values()), f"więcej niż jedna nagroda w grupie: {per_group}"
    steps_total = total_rewards(data["checklistSteps"])
    parts_total = sum(b["amountCents"] for b in data["promotion"]["bonusParts"])
    mx = data["promotion"]["maxBonusCents"]
    assert steps_total == mx, f"suma nagród w ściądze {steps_total} != maxBonusCents {mx}"
    assert parts_total == mx, f"suma bonusParts {parts_total} != maxBonusCents {mx}"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("OK", path, mx)
