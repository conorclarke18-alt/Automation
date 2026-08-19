"""Tests for the candidate matcher.

The submission fixtures below are invented, but they mirror the exact shapes
found in PSP's real submission spreadsheet - including the free-text outcome
column, which is where most of the parsing risk lives.
"""
from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from psp import domain, geo, index, outreach  # noqa: E402
from psp.match import Job, find  # noqa: E402


class TestDomain(unittest.TestCase):
    def test_grades_from_psp_shorthand(self):
        cases = {
            "SP CSWT": "ssw", "ESW Corporate Parenting": "esw",
            "TM Fostering": "tm", "SW FH": "sw", "ATM CWD": "atm",
            "HOS Safeguarding QA": "sm", "NQSW": "nqsw", "IRO": "reviewing",
            "Senior Practitioner CP": "ssw", "AP LAC": "ssw",
        }
        for text, expected in cases.items():
            self.assertEqual(domain.parse_grade(text), expected, text)

    def test_specialisms_from_psp_shorthand(self):
        self.assertIn("cp", domain.parse_specialisms("SP CSWT"))
        self.assertIn("cic", domain.parse_specialisms("ESW Corporate Parenting"))
        self.assertIn("family_help", domain.parse_specialisms("SW FH"))
        self.assertIn("cwd", domain.parse_specialisms("ATM CWD"))
        self.assertIn("exploitation", domain.parse_specialisms("SW Exploitation"))
        self.assertIn("adults", domain.parse_specialisms("SW Adults MIST"))

    def test_adjacent_specialism_scores_below_direct(self):
        direct, _ = domain.specialism_overlap({"cic"}, {"cic"})
        adjacent, _ = domain.specialism_overlap({"cic"}, {"fostering"})
        unrelated, _ = domain.specialism_overlap({"adults"}, {"fostering"})
        self.assertGreater(direct, adjacent)
        self.assertGreater(adjacent, unrelated)

    def test_mobility_and_sponsorship(self):
        self.assertTrue(domain.parse_mobility("Relocating, immediate"))
        self.assertTrue(domain.parse_mobility("will relocate to any county"))
        self.assertFalse(domain.parse_mobility("Kent side"))
        self.assertTrue(domain.parse_sponsorship_need("needs sponsorship transfer"))
        self.assertFalse(domain.parse_sponsorship_need("Kent side"))


class TestOutcomes(unittest.TestCase):
    def test_free_text_outcomes(self):
        cases = {
            "": "submitted",
            "Offered": "offered",
            "offered": "offered",
            "Interview": "interviewed",
            "3/20/2024": "interviewed",
            "Interview but didn’t go": "interview_withdrawn",
            "interview but fucked it didn’t go": "interview_withdrawn",
            "Interview but never went": "interview_withdrawn",
            "Interview but they cancelled": "interview_withdrawn",
            "another agency": "lost_to_other",
            "went directly": "lost_to_other",
            "role closed": "role_dead",
        }
        for raw, expected in cases.items():
            self.assertEqual(index.classify_outcome(raw), expected, repr(raw))

    def test_name_key_joins_across_sources(self):
        self.assertEqual(index.name_key("Rowan Adeyemi (Bexley)"),
                         index.name_key("  ROWAN  ADEYEMI "))
        self.assertEqual(index.name_key("Morgan Yates "), "morgan yates")


class TestGeo(unittest.TestCase):
    def test_known_commutes(self):
        self.assertLess(geo.miles_between("BR1", "ME4"), 30)   # Bromley to Medway
        self.assertGreater(geo.miles_between("AB1", "ME2"), 300)  # Aberdeen to Medway

    def test_same_area_reads_as_doorstep(self):
        self.assertEqual(geo.commute_band(geo.miles_between("B1", "B1"))[2],
                         "right on the doorstep")

    def test_outward_parsing(self):
        self.assertEqual(geo.outward("se18 6ab"), "SE18")
        self.assertEqual(geo.outward("ME2"), "ME2")
        self.assertIsNone(geo.outward(""))


class TestOutreach(unittest.TestCase):
    def test_phone_normalisation(self):
        self.assertEqual(outreach.normalise_phone("07700900123"), "447700900123")
        self.assertEqual(outreach.normalise_phone("+44 7700 900123"), "447700900123")
        self.assertIsNone(outreach.normalise_phone("not a number"))

    def test_initials_are_not_title_cased(self):
        self.assertEqual(outreach.first_name("FP Robinson"), "FP")
        self.assertEqual(outreach.first_name("JORDAN OKAFOR"), "Jordan")

    def test_messages_vary_between_people_but_are_stable_per_person(self):
        job = Job.parse("Medway", "Senior Practitioner CP", "ME4",
                        salary_from=61920)
        names = ["Alice Fern", "Bo Marchetti", "Cara Nwosu",
                 "Dev Ramanathan", "Elin Whitcombe", "Farrah Osei"]
        msgs = [outreach.whatsapp_message(n, job, 22, "Conor", "PSP") for n in names]
        self.assertEqual(len(set(msgs)), len(msgs), "messages must all differ")
        again = outreach.whatsapp_message(names[0], job, 22, "Conor", "PSP")
        self.assertEqual(again, msgs[0], "same person must get the same message")

    def test_message_sells_the_package(self):
        job = Job.parse("Medway", "SP CP", "ME4", salary_from=61920,
                        perks=["a 5k golden hello"])
        msg = outreach.whatsapp_message("Test Person", job, 20, "Conor", "PSP")
        self.assertIn("61,920", msg)
        self.assertIn("golden hello", msg)

    def test_distance_is_vague_to_the_candidate(self):
        job = Job.parse("Medway", "SP CP", "ME4")
        msg = outreach.whatsapp_message("Test Person", job, 31, "Conor", "PSP")
        self.assertNotIn("31", msg)


def _seed(db: str) -> None:
    """A small index exercising history, mobility and sponsorship paths."""
    conn = sqlite3.connect(db)
    conn.executescript(index.SCHEMA)
    people = [
        # (name, address, postcode, position, notes)
        ("Warm Returner", "Bromley", "BR1", "SP", ""),
        ("Rejected Here", "Bromley", "BR1", "SP", ""),
        ("Cold Local", "Chatham", "ME4", "SP", ""),
        ("Far Anchored", "Aberdeen", "AB1", "SP", ""),
        ("Far Relocator", "Aberdeen", "AB1", "SP", "Relocating, will move anywhere"),
        ("Needs Visa", "Aberdeen", "AB1", "SP", "Needs sponsorship transfer"),
    ]
    conn.executemany(
        "INSERT INTO candidates VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [(index.name_key(n), n, addr, pc, geo.outward(pc), "07700900000",
          f"{index.name_key(n).replace(' ', '.')}@example.com", "childrens",
          pos, domain.parse_grade(pos), notes, "Test")
         for n, addr, pc, pos, notes in people])
    subs = [
        ("Warm Returner", "Medway", "2025-06-01", "SP LAC", "Offered"),
        ("Rejected Here", "Medway", "2025-06-01", "SP CSWT", "Interview but didn’t go"),
    ]
    conn.executemany(
        "INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)",
        [(index.name_key(n), n, c, d, jt, raw, index.classify_outcome(raw),
          domain.parse_grade(jt), ",".join(sorted(domain.parse_specialisms(jt))))
         for n, c, d, jt, raw in subs])
    conn.commit()
    conn.close()


class TestMatching(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "t.db")
        _seed(self.db)

    def _run(self, **kw):
        job = Job.parse("Medway", "Senior Practitioner CP", "ME4", **kw)
        return {m.name: m for m in find(self.db, job, limit=20, min_score=0)}

    def test_prior_offer_outranks_a_cold_local(self):
        r = self._run()
        self.assertGreater(r["Warm Returner"].score, r["Cold Local"].score)

    def test_same_team_rejection_is_flagged(self):
        r = self._run()
        flags = " ".join(r["Rejected Here"].flags)
        self.assertIn("pitch a different team", flags)

    def test_anchored_far_candidate_is_dropped(self):
        r = self._run()
        self.assertNotIn("Far Anchored", r)

    def test_relocator_survives_distance(self):
        r = self._run()
        self.assertIn("Far Relocator", r)
        self.assertTrue(r["Far Relocator"].mobile)

    def test_sponsorship_candidate_excluded_unless_client_sponsors(self):
        self.assertNotIn("Needs Visa", self._run())
        r = self._run(sponsors=True)
        self.assertIn("Needs Visa", r)
        self.assertTrue(r["Needs Visa"].needs_sponsorship)

    def test_sponsorship_match_beats_the_same_person_unsponsored(self):
        r = self._run(sponsors=True)
        reasons = " ".join(r["Needs Visa"].reasons)
        self.assertIn("this client sponsors", reasons)


if __name__ == "__main__":
    unittest.main(verbosity=2)
