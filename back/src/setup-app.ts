import { INestApplication, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';

/**
 * Global configuration shared by main.ts and the e2e tests, so that Supertest exercises exactly the same validation as the real
 * application. Anything that changes how requests are handled belongs here, not in main.ts.
 */
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      // Strips properties that are not declared in the DTO, so a client cannot slip unexpected fields (e.g. `passwordHash`) into what
      // reaches services.
      whitelist: true,
      // Turns the JSON body into a DTO instance, which also runs the class-transformer decorators such as @Transform(normalizeEmail).
      transform: true,
      // 422 rather than Nest's default 400 for invalid input, as specified in docs/api-contract.yaml (400 is kept for business rule
      // violations). All constraint messages are joined into a single string so the front can display `message` as is, without knowing the
      // validator's error format.
      exceptionFactory: (errors) =>
        new UnprocessableEntityException(errors.flatMap((error) => Object.values(error.constraints ?? {})).join(' ; ')),
    }),
  );
}
