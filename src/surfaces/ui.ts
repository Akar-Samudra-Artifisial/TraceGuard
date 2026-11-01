import Resolver from '@forge/resolver';
import { listGaps } from './actions';

const resolver = new Resolver();

resolver.define('getOverview', async ({ payload }) => listGaps((payload ?? {}) as Record<string, unknown>));

export const handler = resolver.getDefinitions();
