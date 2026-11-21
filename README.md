# Oqim — administrator paneli

Restoran zalini "oqim" qoidalari bilan boshqarish paneli: React frontend + Node.js API, hujjati Swagger'da.

## Ishga tushirish

Node.js 22 yoki undan yangi kerak.

```bash
npm run setup   # backend va frontend paketlari
npm run dev     # API: http://localhost:4000, panel: http://localhost:5173
```

- Panel: http://localhost:5173
- Swagger UI: http://localhost:4000/api/docs
- OpenAPI JSON: http://localhost:4000/api/openapi.json

Demo kirish (kirish sahifasida ham ko'rinadi):

| Rol | Telefon | PIN |
|---|---|---|
| Ega | +998 90 111 22 33 | 1111 |
| Administrator | +998 90 222 33 44 | 2222 |

Swagger'da: `POST /api/auth/login` → javobdagi `token` ni **Authorize** ga qo'ying.

## Demo rejim

`DEMO_MODE=true` (standart) bo'lsa, har ishga tushishda:

- 35 kunlik savdo tarixi yaratiladi (hisobot va prognoz uchun);
- bugungi zal hozirgi vaqtga qarab quriladi: 9-stol hisobni 4 daqiqadan beri kutyapti (egaga xabar), 8-stolda va'da buzilgan, 5-stolda taomni bekor qilish so'rovi, oshda 6 porsiya qolgan;
- ofitsiantlar o'z tezligida vazifalarni bajaradi, yangi mehmonlar keladi, oshxona taom tayyorlaydi (har 10 soniyada).

Haqiqiy ish uchun `backend/.env` da `DEMO_MODE=false` qiling va `JWT_SECRET` ni almashtiring (`backend/.env.example` dan nusxa oling). Bazani tozalash: `npm run reset`.

## Testlar

```bash
npm test
```

Node.js'ning o'rnatilgan `node:test` bilan, qo'shimcha paketsiz. Har test fayli o'z vaqtinchalik bazasida ishlaydi (`backend/test/setup.js`):

- `rules.test.js` — rang chegaralari, navbat formulasi, va'da va yaxlitlash;
- `operations.test.js` — yordam qoidasi, eskalatsiya (administrator → ega), va'da buzilganda chegirma, qozon va stop-list, audit jurnali o'zgarmasligi;
- `api.test.js` — kirish (PIN, rollar, urinishlar chegarasi), token himoyasi, sozlamalar va audit;
- `time.test.js` — Toshkent vaqti va kun chegaralari.

## Tuzilma

```
backend/
  src/
    server.js            ishga tushirish, eskalatsiya (5 s), simulyatsiya
    app.js               Express, Swagger UI
    schemas.js           zod sxemalar: tekshiruv ham, OpenAPI ham shulardan
    lib/openapi.js       route() — marshrut + tekshiruv + Swagger bitta joyda
    routes/              auth, hall, exceptions, reports, menu, tables, bookings, forecast, staff, settings (+audit)
    services/            qoidalar: rules, operations, escalation, exceptions, hall, dashboard, reports, forecast
    db/                  schema.sql (SQLite), seed, demo, reset
    demo/simulator.js    jonli zal simulyatsiyasi
  test/                  node:test testlari
frontend/
  src/
    pages/               11 ta ekran + kirish
    components/          layout, ui, charts (SVG), hall (zal xaritasi)
    i18n/                uz.js, ru.js
    lib/                 api klient, formatlash, vaqt (Asia/Tashkent)
    store/               zustand: auth, til, xabarlar
```

## Qoidalar (sozlamalarda o'zgaradi)

- Vazifa muddatlari: buyurtma olish 3:00, olib borish 2:00, chaqiruv 1:30, hisob 2:00, yig'ishtirish 4:00.
- Muddatning 70%i o'tsa sariq, muddat o'tsa qizil va administratorga istisno; 2 baravar oshsa egaga.
- Navbat: (kutish / muddat + 0,15) × og'irlik.
- Yordam: ofitsiantda 3 ta ochiq ish bo'lsa va boshqasida kamida 2 ta kam bo'lsa, yangi ish o'shanga.
- Va'da: eng uzoq taom × 1,2 + 3 daqiqa, 30 soniyaga yaxlitlanadi. Buzilsa 10% chegirma o'zi qo'llanadi.
- Qozon: zaxira ogohlantirish chegarasiga tushsa istisno, tugasa taom o'zi stop-listga tushadi.
- Audit jurnali faqat yoziladi: o'zgartirish va o'chirish bazada trigger bilan taqiqlangan.
