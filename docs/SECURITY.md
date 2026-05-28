# 🔒 الأمان - الإصلاحات والممارسات

## ⚠️ المشاكل التي تم إصلاحها في هذه النسخة

### 1. أسرار مكشوفة في `.env`
**المشكلة الأصلية:**
```
STRIPE_API_KEY=sk_test_emergent       ← مفتاح API ظاهر
EMERGENT_LLM_KEY=sk-emergent-eDd87... ← مفتاح LLM ظاهر بالكامل
JWT_SECRET=sahal_super_secret_jwt_key_2026 ← ضعيف ومتوقع
```

**الحل:**
- ✅ تم إنشاء `.env.example` بدون قيم حقيقية
- ✅ تم إضافة `.env` إلى `.gitignore`
- ✅ توليد JWT_SECRET قوي عبر `secrets.token_hex(32)` لو لم يوجد
- ✅ تعليمات صريحة في README لتوليد JWT_SECRET قوي

### 2. CORS مفتوح للجميع
**قبل:** `CORS_ORIGINS="*"` ← يقبل من أي مصدر
**بعد:** قراءة من env، مع توصية بتحديد origins فعلية في الإنتاج

### 3. كلمات المرور بـ bcrypt
- استخدام `passlib[bcrypt]` بدل hashing بسيط
- `pwd_context.verify()` آمن ضد timing attacks

### 4. JWT آمن
- صلاحية محدودة (7 أيام، قابلة للتعديل)
- استخدام HS256
- تحقق من انتهاء الصلاحية + توقيع صالح

### 5. Authorization على Endpoints
- Role-based access control
- التجار يحتاجون موافقة قبل تسجيل الدخول
- المنتجات لا تُضاف إلا لمتجر معتمد

## 🛡️ ممارسات الأمان قبل الإنتاج

### 1. توليد JWT_SECRET قوي
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
ضع الناتج في `.env` كقيمة `JWT_SECRET`

### 2. تكوين CORS بدقة
```env
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 3. MongoDB آمن
```bash
# استخدم authentication
MONGO_URL=mongodb://user:pass@host:27017/dbname?authSource=admin

# أو MongoDB Atlas
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

### 4. HTTPS إجباري
- ضع التطبيق خلف Nginx/Caddy مع SSL
- استخدم `secure: true` للـ cookies

### 5. Rate Limiting
أضف middleware للـ rate limiting:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@api_router.post("/auth/login")
@limiter.limit("5/minute")
async def login(...): ...
```

### 6. تحقق إضافي من المدخلات
- استخدم `EmailStr` من Pydantic للتحقق من الإيميلات
- تحقق من طول كلمة المرور (8+ أحرف، أرقام، رموز)
- تحقق من حجم الصور المرفوعة

### 7. تسجيل الأحداث الأمنية
سجل المحاولات الفاشلة للدخول، تغيير الصلاحيات، الـ transactions:
```python
logger.warning(f"Failed login attempt for {email} from {ip}")
```

### 8. تغيير كلمة مرور Admin الافتراضية
بعد أول تشغيل، **غيّر فوراً** كلمة مرور `admin@sahal.com`!

## 📋 قائمة مراجعة الإنتاج

- [ ] JWT_SECRET قوي وعشوائي (32+ بايت)
- [ ] CORS_ORIGINS محدد بدقة
- [ ] MongoDB مع authentication
- [ ] HTTPS مفعّل
- [ ] Rate limiting على endpoints حساسة
- [ ] Stripe Live keys (ليست test)
- [ ] تغيير كلمة مرور admin الافتراضية
- [ ] إعداد backups دورية للـ DB
- [ ] مراقبة الـ logs والـ errors
- [ ] فحص dependencies بـ `pip-audit` و `npm audit`

## 🚨 الإبلاغ عن ثغرات

إذا اكتشفت ثغرة أمنية، أرسل تقريراً خاصاً بدلاً من فتح issue عام.
