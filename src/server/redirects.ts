export function getStaticRedirect(pathname: string): string | null {
  switch (pathname) {
    case '/history':
    case '/history.html':
      return '/stats';
    default:
      return null;
  }
}
