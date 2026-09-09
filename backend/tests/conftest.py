"""إعدادات الاختبار — يشتغل قبل أي استيراد لـ server.py"""
import os
import sys

# بيئة الاختبار: تطوير مع إيقاف rate limiting
os.environ.setdefault("ENV", "development")
os.environ.setdefault("SAHAL_DISABLE_RATE_LIMIT", "true")
os.environ.setdefault("ALLOW_MOCK_PAYMENTS", "true")

# قاعدة بيانات معزولة للاختبار — لا تلمس بيانات الإنتاج أبداً
os.environ.setdefault("DB_NAME", "sahal_test")
os.environ.setdefault(
    "MONGO_URL",
    os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017"),
)

# اجعل مجلد backend قابل للاستيراد (import server)
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)