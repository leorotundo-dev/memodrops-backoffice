/**
 * Logger Centralizado com Winston
 * 
 * Substitui console.log por um logger estruturado com níveis
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Formato customizado
const customFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Adicionar stack trace se houver erro
  if (stack) {
    msg += `\n${stack}`;
  }
  
  // Adicionar metadata se houver
  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return msg;
});

// Criar logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    // Console (sempre ativo)
    new winston.transports.Console({
      format: combine(
        colorize(),
        customFormat
      )
    }),
    
    // Arquivo de erros (apenas em produção)
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ],
  exitOnError: false
});

// Adicionar stream para Morgan (HTTP logging)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helpers para facilitar uso
export default logger;
