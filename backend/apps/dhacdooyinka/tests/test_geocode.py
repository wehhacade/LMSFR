from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.dhacdooyinka.services.geocode import (
    looks_like_coords,
    parse_coords,
    reverse_geocode_name,
    target_location_name,
)


class _Obj:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Named:
    def __init__(self, name):
        self.name = name


class GeocodeHelpersTests(SimpleTestCase):
    def test_parse_coords_accepts_somalia_gps(self):
        self.assertEqual(parse_coords("2.063609", "45.376541"), (2.063609, 45.376541))

    def test_parse_coords_rejects_zeros_and_utm(self):
        self.assertIsNone(parse_coords("0", "0"))
        self.assertIsNone(parse_coords("1", "2"))
        self.assertIsNone(parse_coords("20223.1", "452049.9"))

    def test_looks_like_coords(self):
        self.assertTrue(looks_like_coords("2.063608, 45.376541"))
        self.assertFalse(looks_like_coords("Heliwa"))
        self.assertFalse(looks_like_coords(""))

    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
    @patch("apps.dhacdooyinka.services.geocode.urllib.request.urlopen")
    def test_reverse_geocode_formats_latin_name(self, mock_urlopen):
        payload = (
            b'{"name":"","address":{"suburb":"Heliwa \\u062d\\u0644\\u064a\\u0644\\u0648\\u0627",'
            b'"city":"Muqdisho","state":"Banaadir \\u0628\\u0646\\u0627\\u062f\\u0631","country":"Soomaaliya"}}'
        )
        mock_urlopen.return_value.__enter__.return_value.read.return_value = payload
        name = reverse_geocode_name("2.063609", "45.376541")
        self.assertEqual(name, "Heliwa, Muqdisho, Banaadir")

    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
    @patch("apps.dhacdooyinka.services.geocode.reverse_geocode_name", return_value="Heliwa, Muqdisho")
    def test_target_uses_geocoded_name_when_bartil_empty(self, _mock_geo):
        obj = _Obj(
            bartilmaameedka_dhacdada=None,
            latitude="2.06",
            longitude="45.37",
            gobolka=_Named("Banaadir"),
            degmada=_Named("Kaaraan"),
            waaxda=_Named("Nageyle"),
            laanta=_Named("Laanta 2"),
        )
        self.assertEqual(target_location_name(obj), "Heliwa, Muqdisho")

    @patch("apps.dhacdooyinka.services.geocode.reverse_geocode_name", return_value="")
    def test_target_uses_admin_hierarchy_when_geocode_empty(self, _mock_geo):
        obj = _Obj(
            bartilmaameedka_dhacdada=None,
            latitude="0",
            longitude="0",
            gobolka=_Named("Banaadir"),
            degmada=_Named("Kaaraan"),
            waaxda=_Named("Nageyle"),
            laanta=_Named("Laanta 2"),
        )
        self.assertEqual(
            target_location_name(obj),
            "Banaadir, Kaaraan, Nageyle, Laanta 2",
        )

    @patch("apps.dhacdooyinka.services.geocode.reverse_geocode_name", return_value="Heliwa")
    def test_target_keeps_specific_named_target(self, mock_geo):
        obj = _Obj(
            bartilmaameedka_dhacdada="Isbitaalka Digfeer",
            latitude="2.06",
            longitude="45.37",
            gobolka=_Named("Banaadir"),
            degmada=_Named("Wadajir"),
            waaxda=None,
            laanta=None,
        )
        self.assertEqual(target_location_name(obj), "Isbitaalka Digfeer")
        mock_geo.assert_not_called()
