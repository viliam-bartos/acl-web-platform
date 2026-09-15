"""
Testy databázového kontraktu metrik.

Vznikly po konkrétní chybě: `Column("Staubli_Tibial_pct", Float)` přiřazené
atributu `staubli_tibial_pct` má v `__table__.columns` klíč rovný **názvu
sloupce**, ne jménu atributu. Mapování postavené na `column.key` proto ukládalo
pět z jedenácti metrik jen jako efemérní atributy instance – v odpovědi API se
objevily, ale do databáze se nikdy nezapsaly.

Spuštění:
    cd backend
    python -m unittest discover -s tests
"""

import sys
import unittest
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import Base  # noqa: E402
from app.models.db_models import CLINICAL_METRIC_KEYS, Patient, Scan  # noqa: E402


class TestMetricMapping(unittest.TestCase):
    def test_mapping_covers_every_contract_metric(self):
        mapping = Scan.metric_columns()
        self.assertEqual(set(mapping), set(CLINICAL_METRIC_KEYS))

    def test_startup_check_passes(self):
        Scan.verify_metric_mapping()

    def test_mapping_points_at_real_attributes(self):
        for name, attribute in Scan.metric_columns().items():
            with self.subTest(metric=name):
                self.assertTrue(hasattr(Scan, attribute), f"Scan nemá atribut {attribute!r}")


class TestMetricPersistence(unittest.TestCase):
    """Metriky musí po zápisu skutečně skončit v databázi, ne v paměti objektu."""

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_all_metrics_round_trip_through_database(self):
        sample = {key: float(index) + 0.5 for index, key in enumerate(CLINICAL_METRIC_KEYS)}

        with self.Session() as db:
            db.add(
                Patient(
                    patient_id="ACL_TEST",
                    surgery_date=date(2025, 1, 1),
                    graft_type="Test",
                )
            )
            scan = Scan(
                id="scan-test",
                patient_id="ACL_TEST",
                scan_date=date(2025, 6, 1),
                months_post_op=6.0,
                model_url="",
                status="ready",
            )
            for name, attribute in Scan.metric_columns().items():
                setattr(scan, attribute, sample[name])
            db.add(scan)
            db.commit()

        # Nová session: hodnoty se musí načíst z databáze, ne z paměti objektu.
        with self.Session() as db:
            loaded = db.query(Scan).filter(Scan.id == "scan-test").one()
            self.assertEqual(loaded.metrics(), sample)


if __name__ == "__main__":
    unittest.main()
