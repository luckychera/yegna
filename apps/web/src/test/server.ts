import { setupServer } from 'msw/node';

/** Test-only network layer. Production code never imports anything from src/test. */
export const server = setupServer();
