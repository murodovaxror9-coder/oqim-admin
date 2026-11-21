import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorText, useT } from '../i18n/index.js'
import { toast } from '../store/toast.js'

// Mutatsiya: muvaffaqiyatda xabar va kerakli so'rovlarni yangilash, xatoda tushunarli matn
export function useAction(fn, { success, invalidate = [], onSuccess } = {}) {
  const client = useQueryClient()
  const { t } = useT()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, variables) => {
      for (const key of [...invalidate, 'status']) client.invalidateQueries({ queryKey: [key] })
      const message = typeof success === 'function' ? success(data, variables) : success
      if (message) toast(message)
      onSuccess?.(data, variables)
    },
    onError: (error) => toast(errorText(t, error), 'error'),
  })
}
