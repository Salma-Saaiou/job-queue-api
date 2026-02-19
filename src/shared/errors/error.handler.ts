import { FastifyInstance, FastifyError } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./app.error";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | AppError | Error, _request, reply) => {
      // Handle Zod validation errors - return FIRST error message only
      if (error instanceof ZodError) {
        // Access the errors array from ZodError
        const firstError = error.issues[0];
        return reply.status(400).send({
          statusCode: 400,
          error: "Validation Error",
          message: firstError.message,
        });
      }

      // Handle known AppErrors
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          statusCode: error.statusCode,
          error: error.name.replace("Error", ""),
          message: error.message,
        });
      }

      // Handle Fastify validation errors
      if ((error as FastifyError).validation) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Validation Error",
          message: "Invalid request data",
        });
      }

      // Handle all other errors
      app.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Something went wrong",
      });
    },
  );
}
