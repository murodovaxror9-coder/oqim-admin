import { ADMIN_ROLES } from '../lib/auth.js'
import { route } from '../lib/openapi.js'
import { localDate } from '../lib/time.js'
import { ConfirmBody, DateQuery, Forecast, IdParams, Ok, PlanUpdate } from '../schemas.js'
import { confirmPlans, getForecast, updatePlan } from '../services/forecast.js'

route(
  'get',
  '/forecast',
  {
    tag: 'Prognoz',
    summary: 'Kun prognozi va qozon rejasi',
    description:
      "Prognoz o'tgan 4 ta shu hafta kunining o'rtachasi. Qozon rejasi zaxira ogohlantirish chegarasiga tushmasdan yangi qozon tayyor bo'ladigan qilib tuziladi.",
    operationId: 'forecast',
    roles: ADMIN_ROLES,
    query: DateQuery,
    response: Forecast,
  },
  (req) => getForecast(req.valid.query.date ?? localDate()),
)

route(
  'patch',
  '/forecast/plans/:id',
  {
    tag: 'Prognoz',
    summary: "Qozon rejasini o'zgartirish",
    operationId: 'updatePlan',
    roles: ADMIN_ROLES,
    params: IdParams,
    body: PlanUpdate,
    response: Ok,
    errors: [404, 409],
  },
  (req) => {
    updatePlan(req.valid.params.id, req.valid.body)
    return { ok: true }
  },
)

route(
  'post',
  '/forecast/plans/confirm',
  {
    tag: 'Prognoz',
    summary: 'Kun rejasini tasdiqlash',
    description: "Tasdiqlangan reja oshxona ekraniga chiqadi va endi o'zgarmaydi.",
    operationId: 'confirmPlans',
    roles: ADMIN_ROLES,
    body: ConfirmBody,
    response: Ok,
    errors: [409],
  },
  (req) => {
    confirmPlans(req.valid.body.date, req.user)
    return { ok: true }
  },
)
