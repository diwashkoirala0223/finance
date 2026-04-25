#!/usr/bin/env python3
"""
ai_analyzer.py — AI Insights Engine
Family Budget & Finance Planner

Rule-based spending analysis engine.
Accepts JSON expense/budget data and outputs structured insights.

Usage:
    python ai_analyzer.py --data ../data/sample.json --household hh_001 --month 2025-04
    python ai_analyzer.py --stdin   (pipe JSON to stdin)
    python ai_analyzer.py --demo    (run with built-in demo data)
"""

import json
import sys
import argparse
from datetime import datetime, date
from collections import defaultdict
from typing import Any


# ─── Data Loaders ────────────────────────────────────────────────────────────

def load_json_file(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_from_stdin() -> dict:
    return json.load(sys.stdin)


# ─── Core Analyzer ────────────────────────────────────────────────────────────

class BudgetAnalyzer:
    """
    Rule-based spending pattern analyser.
    Produces structured insights, warnings, trends, and advice.
    """

    def __init__(self, db: dict, household_id: str, target_month: str = None):
        self.db           = db
        self.household_id = household_id
        self.target_month = target_month or self._current_month()
        self.categories   = self._get_categories()
        self.expenses     = self._get_expenses()
        self.cat_map      = {c["id"]: c for c in self.categories}
        self.user_map     = {u["id"]: u for u in db.get("users", [])}

    # ── Setup Helpers ─────────────────────────────────────────────────────────

    def _current_month(self) -> str:
        return date.today().strftime("%Y-%m")

    def _get_categories(self) -> list:
        return [c for c in self.db.get("categories", [])
                if c.get("household_id") == self.household_id]

    def _get_expenses(self) -> list:
        cat_ids = {c["id"] for c in self.categories}
        return [e for e in self.db.get("expenses", [])
                if e.get("category_id") in cat_ids]

    def _prev_month(self) -> str:
        y, m = map(int, self.target_month.split("-"))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
        return f"{y}-{m:02d}"

    def _expenses_for_month(self, month: str) -> list:
        return [e for e in self.expenses if e.get("date", "").startswith(month)]

    def _cat_spend(self, expenses: list, cat_id: str) -> float:
        return sum(e["amount"] for e in expenses if e.get("category_id") == cat_id)

    # ── Analysis ──────────────────────────────────────────────────────────────

    def analyse(self) -> dict:
        cur_exp  = self._expenses_for_month(self.target_month)
        prev_exp = self._expenses_for_month(self._prev_month())

        total_budget = sum(c.get("budget_amount", 0) for c in self.categories)
        total_spent  = sum(e["amount"] for e in cur_exp)
        total_prev   = sum(e["amount"] for e in prev_exp)

        insights  = []
        warnings  = []
        trends    = []
        advice    = []

        # ── Per-category analysis ─────────────────────────────────────────────
        for cat in self.categories:
            cid    = cat["id"]
            budget = cat.get("budget_amount", 0)
            spent  = self._cat_spend(cur_exp, cid)
            prev   = self._cat_spend(prev_exp, cid)
            pct    = (spent / budget * 100) if budget > 0 else 0
            name   = cat.get("name", "Unknown")
            icon   = cat.get("icon", "📦")

            # Budget breach
            if pct > 100:
                over_amt = spent - budget
                warnings.append({
                    "severity": "critical",
                    "category": name,
                    "message":  f"{icon} {name} exceeded budget by ₹{over_amt:,.0f} ({pct:.0f}% of limit).",
                    "value":    round(pct, 1)
                })
                advice.append(f"Reduce {name} spending by at least ₹{over_amt:,.0f} next month.")

            elif pct >= 80:
                warnings.append({
                    "severity": "warning",
                    "category": name,
                    "message":  f"{icon} {name} is at {pct:.0f}% of budget — approaching limit.",
                    "value":    round(pct, 1)
                })

            # Month-over-month trend
            if prev > 0:
                delta = ((spent - prev) / prev) * 100
                if abs(delta) >= 15:
                    direction = "increased" if delta > 0 else "decreased"
                    trends.append({
                        "category":  name,
                        "direction": direction,
                        "delta_pct": round(abs(delta), 1),
                        "message":   f"{icon} {name} spending {direction} by {abs(delta):.0f}% vs last month (₹{prev:,.0f} → ₹{spent:,.0f})."
                    })

        # ── Overall health ────────────────────────────────────────────────────
        overall_pct = (total_spent / total_budget * 100) if total_budget > 0 else 0
        insights.append({
            "type":    "summary",
            "message": f"Total spending this month: ₹{total_spent:,.0f} out of ₹{total_budget:,.0f} budget ({overall_pct:.0f}% used).",
            "value":   round(overall_pct, 1)
        })

        # Savings insight
        saved = total_budget - total_spent
        if saved > 0:
            insights.append({
                "type":    "positive",
                "message": f"Great discipline! You have ₹{saved:,.0f} ({(saved/total_budget*100):.0f}%) of your total budget remaining.",
                "value":   round(saved, 0)
            })
            advice.append(f"Consider saving or investing the ₹{saved:,.0f} surplus this month.")
        else:
            insights.append({
                "type":    "negative",
                "message": f"You are ₹{abs(saved):,.0f} over the total household budget this month.",
                "value":   round(abs(saved), 0)
            })

        # Month-over-month overall
        if total_prev > 0:
            mom_delta = ((total_spent - total_prev) / total_prev) * 100
            direction = "up" if mom_delta > 0 else "down"
            insights.append({
                "type":    "trend",
                "message": f"Total spending is {direction} {abs(mom_delta):.0f}% compared to last month (₹{total_prev:,.0f} vs ₹{total_spent:,.0f}).",
                "value":   round(mom_delta, 1)
            })

        # Top spender
        user_spend = defaultdict(float)
        for e in cur_exp:
            user_spend[e.get("user_id", "unknown")] += e["amount"]
        if user_spend:
            top_uid, top_amt = max(user_spend.items(), key=lambda x: x[1])
            top_user = self.user_map.get(top_uid, {}).get("name", top_uid)
            insights.append({
                "type":    "info",
                "message": f"Highest spender this month: {top_user} with ₹{top_amt:,.0f} ({(top_amt/total_spent*100):.0f}% of total).",
                "value":   round(top_amt, 0)
            })

        # Most expensive category
        cat_totals = [(c, self._cat_spend(cur_exp, c["id"])) for c in self.categories]
        cat_totals.sort(key=lambda x: x[1], reverse=True)
        if cat_totals and cat_totals[0][1] > 0:
            top_cat, top_spend = cat_totals[0]
            insights.append({
                "type":    "info",
                "message": f"Highest expense category: {top_cat.get('icon','')} {top_cat['name']} at ₹{top_spend:,.0f} ({(top_spend/total_spent*100):.0f}% of total).",
                "value":   round(top_spend, 0)
            })

        # Frequency analysis — daily average
        days_in_month = 30
        daily_avg = total_spent / days_in_month
        insights.append({
            "type":    "info",
            "message": f"Average daily spend: ₹{daily_avg:,.0f}/day based on a 30-day month.",
            "value":   round(daily_avg, 0)
        })

        # ── Score ─────────────────────────────────────────────────────────────
        score = self._compute_health_score(overall_pct, len(warnings))

        return {
            "generated_at":  datetime.now().isoformat(),
            "household_id":  self.household_id,
            "month":         self.target_month,
            "health_score":  score,
            "health_label":  self._score_label(score),
            "summary": {
                "total_budget":  total_budget,
                "total_spent":   total_spent,
                "total_saved":   max(total_budget - total_spent, 0),
                "utilisation_pct": round(overall_pct, 1)
            },
            "insights":  insights,
            "warnings":  warnings,
            "trends":    trends,
            "advice":    advice
        }

    def _compute_health_score(self, utilisation_pct: float, warning_count: int) -> int:
        score = 100
        if utilisation_pct > 100:
            score -= min(40, int((utilisation_pct - 100) * 2))
        elif utilisation_pct > 90:
            score -= 10
        elif utilisation_pct > 80:
            score -= 5
        score -= warning_count * 8
        return max(0, min(100, score))

    def _score_label(self, score: int) -> str:
        if score >= 80: return "Excellent 🟢"
        if score >= 60: return "Good 🟡"
        if score >= 40: return "Needs Attention 🟠"
        return "Critical 🔴"


# ─── CLI Renderer ─────────────────────────────────────────────────────────────

def print_report(result: dict, fmt: str = "text"):
    if fmt == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    SEP = "─" * 60
    print(f"\n{'═'*60}")
    print(f"  🤖  FamilyLedger AI Insights Engine")
    print(f"  Household: {result['household_id']}  |  Month: {result['month']}")
    print(f"  Generated: {result['generated_at'][:19]}")
    print(f"{'═'*60}\n")

    s = result["summary"]
    print(f"  📊 HEALTH SCORE: {result['health_score']}/100  —  {result['health_label']}")
    print(f"  Budget: ₹{s['total_budget']:,.0f}  |  Spent: ₹{s['total_spent']:,.0f}  |  Utilisation: {s['utilisation_pct']}%")
    print()

    if result["warnings"]:
        print(f"  🚨 WARNINGS ({len(result['warnings'])})")
        print(f"  {SEP}")
        for w in result["warnings"]:
            prefix = "  ❌" if w["severity"] == "critical" else "  ⚠️ "
            print(f"  {prefix} {w['message']}")
        print()

    print("  💡 INSIGHTS")
    print(f"  {SEP}")
    for i in result["insights"]:
        print(f"  • {i['message']}")
    print()

    if result["trends"]:
        print("  📈 TRENDS")
        print(f"  {SEP}")
        for t in result["trends"]:
            arrow = "↑" if t["direction"] == "increased" else "↓"
            print(f"  {arrow} {t['message']}")
        print()

    if result["advice"]:
        print("  🎯 ADVICE")
        print(f"  {SEP}")
        for idx, a in enumerate(result["advice"], 1):
            print(f"  {idx}. {a}")
        print()

    print(f"{'═'*60}\n")


# ─── Demo Data ────────────────────────────────────────────────────────────────

DEMO_DATA = {
    "households": [{"id": "hh_demo", "name": "Demo Family"}],
    "users": [
        {"id": "u_d1", "name": "Alice Demo",  "household_id": "hh_demo"},
        {"id": "u_d2", "name": "Bob Demo",    "household_id": "hh_demo"}
    ],
    "categories": [
        {"id": "c1", "household_id": "hh_demo", "name": "Food",      "budget_amount": 12000, "icon": "🛒"},
        {"id": "c2", "household_id": "hh_demo", "name": "Transport", "budget_amount": 6000,  "icon": "🚗"},
        {"id": "c3", "household_id": "hh_demo", "name": "Utilities", "budget_amount": 5000,  "icon": "💡"},
        {"id": "c4", "household_id": "hh_demo", "name": "Education", "budget_amount": 8000,  "icon": "📚"},
        {"id": "c5", "household_id": "hh_demo", "name": "Misc",      "budget_amount": 4000,  "icon": "📦"}
    ],
    "expenses": [
        {"id": "e1",  "category_id": "c1", "user_id": "u_d1", "amount": 4200, "date": "2025-04-03", "notes": "Groceries"},
        {"id": "e2",  "category_id": "c1", "user_id": "u_d2", "amount": 3800, "date": "2025-04-10", "notes": "Supermarket"},
        {"id": "e3",  "category_id": "c1", "user_id": "u_d1", "amount": 5100, "date": "2025-04-18", "notes": "Bulk buy"},
        {"id": "e4",  "category_id": "c2", "user_id": "u_d1", "amount": 2200, "date": "2025-04-05", "notes": "Petrol"},
        {"id": "e5",  "category_id": "c2", "user_id": "u_d2", "amount": 1800, "date": "2025-04-15", "notes": "Taxi"},
        {"id": "e6",  "category_id": "c3", "user_id": "u_d2", "amount": 3100, "date": "2025-04-07", "notes": "Electricity"},
        {"id": "e7",  "category_id": "c4", "user_id": "u_d2", "amount": 6500, "date": "2025-04-12", "notes": "School fee"},
        {"id": "e8",  "category_id": "c5", "user_id": "u_d1", "amount": 2900, "date": "2025-04-20", "notes": "Clothing"},
        # Previous month
        {"id": "e9",  "category_id": "c1", "user_id": "u_d1", "amount": 9000, "date": "2025-03-15", "notes": "Groceries Mar"},
        {"id": "e10", "category_id": "c2", "user_id": "u_d1", "amount": 2500, "date": "2025-03-20", "notes": "Fuel Mar"},
        {"id": "e11", "category_id": "c4", "user_id": "u_d2", "amount": 4000, "date": "2025-03-10", "notes": "Tuition Mar"},
    ]
}


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FamilyLedger AI Insights Engine")
    parser.add_argument("--data",       help="Path to JSON database file")
    parser.add_argument("--household",  help="Household ID to analyse", default="hh_001")
    parser.add_argument("--month",      help="Month to analyse (YYYY-MM)", default=None)
    parser.add_argument("--stdin",      action="store_true", help="Read JSON from stdin")
    parser.add_argument("--demo",       action="store_true", help="Run with demo data")
    parser.add_argument("--format",     choices=["text", "json"], default="text", help="Output format")
    args = parser.parse_args()

    try:
        if args.demo:
            db = DEMO_DATA
            household_id = "hh_demo"
            month = "2025-04"
        elif args.stdin:
            db = load_from_stdin()
            household_id = args.household
            month = args.month
        elif args.data:
            db = load_json_file(args.data)
            household_id = args.household
            month = args.month
        else:
            print("No input specified. Running demo…\n")
            db = DEMO_DATA
            household_id = "hh_demo"
            month = "2025-04"

        analyzer = BudgetAnalyzer(db, household_id, month)
        result   = analyzer.analyse()
        print_report(result, fmt=args.format)

    except FileNotFoundError as e:
        print(f"Error: File not found — {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON — {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
