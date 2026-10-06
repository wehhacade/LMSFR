"""Tests for completion breakdown helpers."""

from django.test import SimpleTestCase

from apps.surveys.queries import completion_breakdown_items


class CompletionBreakdownItemsTest(SimpleTestCase):
    def test_empty_returns_zeros(self):
        items = completion_breakdown_items(0, 0)
        self.assertEqual([i["count"] for i in items], [0, 0])
        self.assertEqual([i["pct"] for i in items], [0.0, 0.0])

    def test_small_complete_slice_not_rounded_away(self):
        items = completion_breakdown_items(81, 100_049)
        by_label = {i["label"]: i for i in items}
        self.assertEqual(by_label["Completed"]["count"], 81)
        self.assertGreater(by_label["Completed"]["pct"], 0)
        self.assertEqual(by_label["Partial"]["count"], 100_049)
        total_pct = sum(i["pct"] for i in items)
        self.assertAlmostEqual(total_pct, 100.0, places=1)

    def test_all_partial(self):
        items = completion_breakdown_items(0, 50)
        by_label = {i["label"]: i for i in items}
        self.assertEqual(by_label["Partial"]["pct"], 100.0)
