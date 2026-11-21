import { Link } from 'react-router'
import { Empty } from '../components/ui/States.jsx'
import { useT } from '../i18n/index.js'

export function NotFoundPage() {
  const { t } = useT()
  return (
    <Empty icon="info" title="404">
      <Link to="/" className="font-semibold text-brand hover:underline">
        {t('nav.today')}
      </Link>
    </Empty>
  )
}
