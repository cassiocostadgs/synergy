import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Informa se o usuário pediu ao sistema para reduzir animações. Usado para não
 * girar a roleta em quem tem sensibilidade a movimento — nesses casos o
 * resultado aparece direto.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduzir, setReduzir] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => setReduzir(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduzir
}
