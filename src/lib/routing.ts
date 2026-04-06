import type { IngelogdeGebruiker } from '../types';

const orderedRoutes = ['/', '/relaties', '/notes', '/mailbox', '/database', '/settings', '/beheer'] as const;

export function hasAccessToRoute(user: IngelogdeGebruiker | null, path: string): boolean {
  if (!user) {
    return false;
  }

  switch (path) {
    case '/':
      return true;
    case '/relaties':
      return true;
    case '/notes':
      return true;
    case '/mailbox':
      return true;
    case '/database':
      return true;
    case '/settings':
      return true;
    case '/beheer':
      return user.beheer;
    default:
      return false;
  }
}

export function getDefaultRoute(user: IngelogdeGebruiker | null): string {
  if (!user) {
    return '/login';
  }

  for (const route of orderedRoutes) {
    if (hasAccessToRoute(user, route)) {
      return route;
    }
  }

  return '/login';
}
