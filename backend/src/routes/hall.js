import { db } from '../db/index.js'
import { ADMIN_ROLES } from '../lib/auth.js'
import { route } from '../lib/openapi.js'
import { Hall, IdParams, MoveOrderBody, Ok, ReassignBody, Today } from '../schemas.js'
import { getToday } from '../services/dashboard.js'
import { getHall } from '../services/hall.js'
import { moveOrder, reassignTask } from '../services/operations.js'

route(
  'get',
  '/dashboard/today',
  {
    tag: 'Bugun',
    summary: "Bugungi ko'rsatkichlar",
    description: "Tushum, buyurtmalar, xizmat tezligi va vazifalar o'tgan haftaning shu kuni bilan aynan shu soatgacha solishtiriladi.",
    operationId: 'today',
    roles: ADMIN_ROLES,
    response: Today,
  },
  () => getToday(),
)

route(
  'get',
  '/hall',
  {
    tag: 'Jonli zal',
    summary: 'Zal xaritasi, stollar holati va vazifalar navbati',
    operationId: 'hall',
    roles: ADMIN_ROLES,
    response: Hall,
  },
  () => getHall(),
)

route(
  'post',
  '/orders/:id/move',
  {
    tag: 'Jonli zal',
    summary: "Buyurtmani boshqa stolga ko'chirish",
    operationId: 'moveOrder',
    roles: ADMIN_ROLES,
    params: IdParams,
    body: MoveOrderBody,
    response: Ok,
    errors: [404, 409],
  },
  (req) => {
    db.transaction(() => moveOrder(req.valid.params.id, req.valid.body.tableId, req.user))()
    return { ok: true }
  },
)

route(
  'post',
  '/tasks/:id/reassign',
  {
    tag: 'Jonli zal',
    summary: 'Vazifani boshqa ofitsiantga berish',
    operationId: 'reassignTask',
    roles: ADMIN_ROLES,
    params: IdParams,
    body: ReassignBody,
    response: Ok,
    errors: [404, 409],
  },
  (req) => {
    db.transaction(() => reassignTask(req.valid.params.id, req.valid.body.waiterId, req.user))()
    return { ok: true }
  },
)
