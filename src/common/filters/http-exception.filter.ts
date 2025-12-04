import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Erro interno do servidor';

    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Se for uma exceção HTTP, extrair mensagem e erros
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        errorResponse.message = (response as any).message || exception.message;
        // Incluir erros de validação se existirem
        if ((response as any).errors) {
          errorResponse.errors = (response as any).errors;
        }
      } else {
        errorResponse.message = response as string;
      }
    } else {
      errorResponse.message = 'Erro interno do servidor';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
      );
    } else {
      // Log detalhado para erros de validação
      if (status === 400 && errorResponse.errors) {
        this.logger.warn(
          `${request.method} ${request.url} - Erros de validação: ${JSON.stringify(errorResponse.errors)}`,
        );
      } else {
        this.logger.warn(
          `${request.method} ${request.url} - ${JSON.stringify(errorResponse)}`,
        );
      }
    }

    response.status(status).json(errorResponse);
  }
}
