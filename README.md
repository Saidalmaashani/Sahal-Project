# 🛍️ سهل (Sahal) - منصة التجارة الإلكترونية

منصة تجارة إلكترونية متكاملة بالعربية (RTL)، تربط بين التجار والمتسوقين والسائقين في تطبيق واحد.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![MongoDB](https://img.shields.io/badge/mongodb-7+-green.svg)

## ✨ الميزات

- 🔐 **مصادقة متعددة الأدوار** (Admin, Merchant, Shopper, Driver) + Google OAuth
- 🏪 **نظام موافقة المتاجر** - التجار يحتاجون موافقة الإدارة
- 💳 **مدفوعات Stripe** (يعمل بدون Stripe في وضع التطوير)
- 🤖 **AI Chat** بالعربية (GPT-4o-mini عبر Emergent)
- 🎁 **نظام إحالات** بمكافأة 10% + لوحة متصدرين
- 🚚 **تتبع التوصيل المباشر** (Real-time location)
- 📱 **تصميم Responsive** كامل
- 🌐 **عربي RTL** بخطوط Tajawal/Cairo

## 🏗️ البنية

```
sahal/
├── backend/          Python FastAPI + MongoDB
├── frontend/         React 19 + Tailwind + shadcn/ui
└── docs/             التوثيق
```

## 🚀 التشغيل السريع

### المتطلبات

- Python 3.10+
- Node.js 18+
- MongoDB 7+ (شغّال على `localhost:27017`)

### 1. Backend

```bash
cd backend

# إنشاء بيئة افتراضية
python -m venv venv
source venv/bin/activate   # على Linux/Mac
# أو: venv\Scripts\activate  # على Windows

# تثبيت المتطلبات
pip install -r requirements.txt

# نسخ إعدادات البيئة
cp .env.example .env

# توليد JWT_SECRET قوي وضعه في .env
python -c "import secrets; print(secrets.token_hex(32))"

# تشغيل الخادم
uvicorn server:app --reload --port 8000
```

سيكون الخادم على: `http://localhost:8000`
- التوثيق التفاعلي: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend

# تثبيت المتطلبات
npm install

# نسخ إعدادات البيئة
cp .env.example .env

# تشغيل التطبيق
npm start
```

سيفتح على: `http://localhost:3000`

### 3. إنشاء حساب الإدارة الأول

```bash
curl -X POST http://localhost:8000/api/seed/admin
```

**بيانات الدخول الافتراضية:**
- البريد: `admin@sahal.com`
- كلمة المرور: `admin123`

⚠️ **غيّر كلمة المرور فوراً بعد أول تسجيل دخول!**

## 🧪 الاختبارات

```bash
cd backend
pytest tests/
```

## 📚 التوثيق

- [البنية المعمارية](docs/ARCHITECTURE.md)
- [الأمان والإصلاحات](docs/SECURITY.md)
- [PRD - متطلبات المنتج](docs/PRD.md)

## 🔒 ملاحظات أمنية مهمة قبل الإنتاج

1. **JWT_SECRET**: ولّد قيمة عشوائية قوية (32+ بايت)
2. **CORS_ORIGINS**: حدد origins فعلية بدل `*`
3. **MongoDB**: استخدم authentication + TLS في الإنتاج
4. **Stripe**: استخدم Live keys بعد الاختبار
5. **HTTPS**: نشر التطبيق خلف HTTPS فقط
6. **Rate limiting**: أضف rate limiting على endpoints الحساسة

## 🎨 نظام التصميم

| الاستخدام | اللون |
|----------|------|
| Primary | `#4338CA` (بنفسجي) |
| Accent | `#F97316` (برتقالي) |
| Success | `#10B981` (أخضر) |
| Danger | `#E11D48` (أحمر) |

**الخطوط:**
- العناوين: `Cairo`
- النصوص: `Tajawal`
- الكود: `JetBrains Mono`

## 📦 الـ Stack الكامل

**Backend:**
- FastAPI 0.115
- Motor (MongoDB async)
- PyJWT + passlib[bcrypt]
- Pydantic 2.x
- Emergent integrations (Stripe + LLM) — اختياري

**Frontend:**
- React 19
- React Router 7
- Tailwind CSS 3.4
- shadcn/ui (Radix UI)
- Axios
- Sonner (toasts)
- Lucide icons

## 📝 الترخيص

MIT License — انظر [LICENSE](LICENSE)

## 🤝 المساهمة

المساهمات مرحب بها! افتح issue أو pull request.

---

صُنع بـ ❤️ للمجتمع العربي
