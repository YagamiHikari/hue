# -*- coding: utf-8 -*-
"""Text Utilities."""
# flake8: noqa

from __future__ import absolute_import, unicode_literals

from difflib import SequenceMatcher

from kombu import version_info_t
from kombu.five import string_t


def escape_regex(p, white=''):
    # type: (str, str) -> str
    """Escape string for use within a regular expression."""
    # what's up with re.escape? that code must be neglected or something
    return ''.join(c if c.isalnum() or c in white
                   else ('\\000' if c == '\000' else '\\' + c)
                   for c in p)


def fmatch_iter(needle, haystack, min_ratio=0.6):
    # type: (str, Sequence[str], float) -> Iterator[Tuple[float, str]]
    """Fuzzy match: iteratively.

    Yields:
        Tuple: of ratio and key.
    """
    for key in haystack:
        ratio = SequenceMatcher(None, needle, key).ratio()
        if ratio >= min_ratio:
            yield ratio, key


def fmatch_best(needle, haystack, min_ratio=0.6):
    # type: (str, Sequence[str], float) -> str
    """Fuzzy match - Find best match (scalar)."""
    try:
        return sorted(
            fmatch_iter(needle, haystack, min_ratio), reverse=True,
        )[0][1]
    except IndexError:
        pass


def version_string_as_tuple(s):
    # type (str) -> version_info_t
    """Convert version string to version info tuple."""
    v = _unpack_version(*s.split('.'))
    # X.Y.3a1 -> (X, Y, 3, 'a1')
    if isinstance(v.micro, string_t):
        v = version_info_t(v.major, v.minor, *_splitmicro(*v[2:]))
    # X.Y.3a1-40 -> (X, Y, 3, 'a1', '40')
    if not v.serial and v.releaselevel and '-' in v.releaselevel:
        v = version_info_t(*list(v[0:3]) + v.releaselevel.split('-'))
    return v


def _unpack_version(major, minor=0, micro=0, releaselevel='', serial=''):
    # type: (int, int, int, str, str) -> version_info_t
    return version_info_t(int(major), int(minor), micro, releaselevel, serial)


def _splitmicro(micro, releaselevel='', serial=''):
    # type: (int, str, str) -> Tuple[int, str, str]
    for index, char in enumerate(micro):
        if not char.isdigit():
            break
    else:
        return int(micro or 0), releaselevel, serial
    return int(micro[:index]), micro[index:], serial
