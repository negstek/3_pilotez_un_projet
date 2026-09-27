/* eslint-disable react/only-export-components -- test helper, fast refresh does not apply */
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '../auth/AuthContext.tsx'

/** Renders the current path, so tests can assert on redirections. */
function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

/**
 * Renders a screen with the same providers as the real app (router + auth), on an in-memory router.
 *
 * @param route Initial URL.
 * @param path Route pattern under which `ui` is mounted. Navigating anywhere else renders LocationProbe, whose text is the new path.
 */
export function renderWithProviders(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}
