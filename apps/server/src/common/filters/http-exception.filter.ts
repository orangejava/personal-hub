import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../types/request-id';

interface ErrorBody {
  code: string;
  message: string;
  details: unknown[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = this.toErrorBody(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, requestId: request.requestId },
        'Unhandled request exception',
      );
    }

    const body = {
      error,
      requestId: request.requestId,
    };

    response.status(status).json(body);
  }

  private toErrorBody(exception: unknown, status: number): ErrorBody {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          code: this.codeForStatus(status),
          message: response,
          details: [],
        };
      }

      if (typeof response === 'object' && response !== null) {
        const payload = response as {
          code?: string;
          message?: string | string[];
          details?: unknown[];
        };

        return {
          code: payload.code ?? this.codeForStatus(status),
          message: Array.isArray(payload.message)
            ? '请求参数校验失败'
            : (payload.message ?? this.messageForStatus(status)),
          details: payload.details ?? (Array.isArray(payload.message) ? payload.message : []),
        };
      }
    }

    return {
      code: this.codeForStatus(status),
      message: this.messageForStatus(status),
      details: [],
    };
  }

  private codeForStatus(status: number): string {
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      return 'INFRASTRUCTURE_UNAVAILABLE';
    }

    if (status === HttpStatus.BAD_REQUEST) {
      return 'VALIDATION_FAILED';
    }

    return status >= HttpStatus.INTERNAL_SERVER_ERROR
      ? 'INTERNAL_SERVER_ERROR'
      : 'HTTP_REQUEST_FAILED';
  }

  private messageForStatus(status: number): string {
    return status >= HttpStatus.INTERNAL_SERVER_ERROR
      ? '服务暂时不可用，请稍后重试'
      : '请求未能完成';
  }
}
