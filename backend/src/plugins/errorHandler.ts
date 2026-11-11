import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (!(error instanceof Error)) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }

    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message
      });
    }

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message
    });
  });
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler-plugin'
});
