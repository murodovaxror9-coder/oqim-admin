export const NAV = [
  {
    group: 'watch',
    items: [
      { to: '/', key: 'today', icon: 'today' },
      { to: '/hall', key: 'hall', icon: 'hall' },
      { to: '/exceptions', key: 'exceptions', icon: 'exceptions', badge: 'exceptions' },
      { to: '/reports', key: 'reports', icon: 'reports' },
    ],
  },
  {
    group: 'manage',
    items: [
      { to: '/menu', key: 'menu', icon: 'menu' },
      { to: '/tables', key: 'tables', icon: 'tables' },
      { to: '/bookings', key: 'bookings', icon: 'bookings' },
      { to: '/forecast', key: 'forecast', icon: 'forecast' },
      { to: '/staff', key: 'staff', icon: 'staff' },
      { to: '/settings', key: 'settings', icon: 'settings' },
      { to: '/audit', key: 'audit', icon: 'audit' },
      { key: 'stock', icon: 'stock', disabled: true },
    ],
  },
]
