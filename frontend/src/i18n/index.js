import { useCallback } from 'react'
import { useLang } from '../store/lang.js'
import ru from './ru.js'
import uz from './uz.js'

export const dictionaries = { uz, ru }

// Kalitlar ichida nuqta bo'lishi mumkin: events['auth.login']
function lookup(node, key) {
  if (!node || typeof node !== 'object') return undefined
  if (key in node) return node[key]
  const parts = key.split('.')
  for (let i = 1; i < parts.length; i += 1) {
    const head = parts.slice(0, i).join('.')
    if (head in node) {
      const found = lookup(node[head], parts.slice(i).join('.'))
      if (found !== undefined) return found
    }
  }
  return undefined
}

function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function translate(lang, key, params) {
  let text = lookup(dictionaries[lang], key)
  if (text === undefined) text = lookup(dictionaries.uz, key)
  if (typeof text !== 'string') return key
  if (!params) return text
  // Ruscha ko'plik: {n|гость|гостя|гостей}
  text = text.replace(/\{(\w+)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g, (match, name, one, few, many) => plural(Number(params[name]), one, few, many))
  return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined && params[name] !== null ? String(params[name]) : match))
}

// t('menu.title'), t('common.table', { n: 3 })
export function useT() {
  const lang = useLang((state) => state.lang)
  const t = useCallback((key, params) => translate(lang, key, params), [lang])
  return { t, lang }
}

// Server xatosini foydalanuvchi tiliga o'girish
export function errorText(t, error) {
  if (!error) return ''
  const key = `errors.${error.code}`
  const text = t(key)
  if (text !== key) return text
  return error.message && error.message !== error.code ? error.message : t('errors.internal')
}
