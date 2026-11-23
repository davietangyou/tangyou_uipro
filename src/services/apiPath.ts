/** Keep the deployed API inside the app's own reverse-proxy namespace. */
export function apiPath(path: string): string {
  return location.pathname === '/diaguide' || location.pathname.startsWith('/diaguide/')
    ? `/diaguide${path}` : path;
}
