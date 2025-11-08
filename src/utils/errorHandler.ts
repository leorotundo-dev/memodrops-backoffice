import { logger } from './logger.js';

export class AdapterError extends Error {
  constructor(
    message: string,
    public source: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public url?: string, public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Wrapper para executar adapters com tratamento de erro robusto
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: {
    adapter: string;
    operation: string;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`[${context.adapter}] Erro em ${context.operation}:`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Re-throw como AdapterError para tratamento consistente
    throw new AdapterError(
      `Erro em ${context.adapter}.${context.operation}: ${errorMessage}`,
      context.adapter,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Wrapper para requisições HTTP com retry e timeout
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = 3,
  timeout: number = 30000
): Promise<Response> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          url,
          response.status
        );
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        logger.warn(`Tentativa ${i + 1}/${retries} falhou para ${url}. Tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new NetworkError(
    `Falha após ${retries} tentativas: ${lastError?.message}`,
    url
  );
}

/**
 * Middleware global de erro para Express
 */
export function globalErrorHandler(err: any, req: any, res: any, next: any) {
  // Log do erro
  logger.error('Erro não tratado:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Resposta baseada no tipo de erro
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Erro de validação',
      message: err.message,
      field: err.field
    });
  }

  if (err instanceof NetworkError) {
    return res.status(502).json({
      success: false,
      error: 'Erro de rede',
      message: err.message,
      url: err.url,
      statusCode: err.statusCode
    });
  }

  if (err instanceof AdapterError) {
    return res.status(500).json({
      success: false,
      error: 'Erro no adapter',
      message: err.message,
      source: err.source
    });
  }

  // Erro genérico
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'production' 
      ? 'Ocorreu um erro inesperado' 
      : err.message
  });
}
