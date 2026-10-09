import { Logger } from '@nestjs/common';

// Setup file of the unit and e2e tests: the business logs of the services (Nest's Logger) would drown the test report. The e2e tests do not
// call app.useLogger(), so this also covers them; the HTTP request lines of pino are disabled there by LOG_LEVEL=silent.
Logger.overrideLogger(false);
