from discovery.link_check import check_link


def fake(status=200, body="", exc=None):
    def f(url, timeout):
        if exc:
            raise exc
        return status, body
    return f


def test_200_name_found_case_insensitive():
    assert check_link("u", "Stopwatch Stop", fake(200, "<h1>STOPWATCH   stop</h1>")) == "확인됨"


def test_200_name_missing():
    assert check_link("u", "스톱워치", fake(200, "다른 게임")) == "열림-이름불일치"


def test_404_not_open():
    assert check_link("u", "x", fake(404)) == "열리지 않음"


def test_500_not_open():
    assert check_link("u", "x", fake(503)) == "열리지 않음"


def test_429_unverified():
    assert check_link("u", "x", fake(429)) == "미확인"


def test_timeout_unverified():
    assert check_link("u", "x", fake(exc=TimeoutError())) == "미확인"
