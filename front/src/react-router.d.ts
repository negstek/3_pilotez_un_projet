import 'react-router'

// React Router types `navigate()` as returning `void | Promise<void>` because the same hook serves the data routers, where navigation is
// asynchronous. With <BrowserRouter> (see main.tsx) it is synchronous, so the type is narrowed as the React Router documentation recommends.
// Without it, every navigate() call would be flagged as a floating promise.
declare module 'react-router' {
  interface NavigateFunction {
    (to: To, options?: NavigateOptions): void
    (delta: number): void
  }
}
