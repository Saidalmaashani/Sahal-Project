"""إعدادات الاختبار — يشغّل خادم uvicorn حقيقياً على منفذ حر وقاعدة بيانات معزولة.
يعمل قبل استيراد أي وحدة اختبار ويضبط TEST_BACKEND_URL ليقرأها test_backend.
"""
import atexit
import os
import socket
import subprocess
import sys
import time
import urllib.request

# بيئة الاختبار: تطوير مع إيقاف rate limiting وقاعدة بيانات منفصلة
os.environ.setdefault("ENV", "development")
os.environ.setdefault("SAHAL_DISABLE_RATE_LIMIT", "true")
os.environ.setdefault("SAHAL_TEST_MODE", "true")
os.environ.setdefault("ALLOW_MOCK_PAYMENTS", "true")
os.environ.setdefault("DB_NAME", "sahal_test")
os.environ.setdefault(
    "MONGO_URL",
    os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017"),
)

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def _find_free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


_server_proc = None


def _spawn_server() -> str:
    """يبدأ uvicorn server:app بأمان ويعيد base_url عند الجاهزية"""
    global _server_proc
    port = _find_free_port()
    env = dict(os.environ)
    env.update({
        "DB_NAME": "sahal_test",
        "ENV": "development",
        "SAHAL_DISABLE_RATE_LIMIT": "true",
        "ALLOW_MOCK_PAYMENTS": "true",
        "PYTHONUNBUFFERED": "1",
    })
    _server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server:app",
         "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=_BACKEND_DIR,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    for _ in range(120):
        if _server_proc.poll() is not None:
            raise RuntimeError(
                f"uvicorn exited early with code {_server_proc.returncode}"
            )
        try:
            with urllib.request.urlopen(base + "/health", timeout=2) as resp:
                if resp.status == 200:
                    return base
        except Exception:
            time.sleep(0.5)
    _kill_server()
    raise RuntimeError("uvicorn did not become ready in time")


def _kill_server():
    global _server_proc
    if _server_proc is None:
        return
    _server_proc.terminate()
    try:
        _server_proc.wait(timeout=10)
    except Exception:
        _server_proc.kill()
    _server_proc = None


atexit.register(_kill_server)

# يُنفَّذ قبل استيراد test_backend.py فيقرأ الوحدة هذا المتغير تلقائياً
os.environ["TEST_BACKEND_URL"] = _spawn_server()


def pytest_sessionfinish(session, exitstatus):
    _kill_server()