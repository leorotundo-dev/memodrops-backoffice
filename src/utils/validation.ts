import { z } from 'zod';

// Schema para geração de drops
export const GenerateDropsSchema = z.object({
  editalId: z.number().int().positive(),
  subjectName: z.string().min(1).max(100),
  topicLimit: z.number().int().positive().max(20).optional().default(5)
});

export type GenerateDropsInput = z.infer<typeof GenerateDropsSchema>;

// Schema para processamento de harvest items
export const ProcessHarvestSchema = z.object({
  limit: z.number().int().positive().max(1000).optional().default(100),
  source: z.string().optional()
});

export type ProcessHarvestInput = z.infer<typeof ProcessHarvestSchema>;

// Schema para coleta de dados
export const HarvestSchema = z.object({
  source: z.enum(['fgv', 'quadrix', 'pci', 'concursosnobrasil', 'fgd', 'all']),
  limit: z.number().int().positive().max(100).optional().default(50)
});

export type HarvestInput = z.infer<typeof HarvestSchema>;

// Schema para criação de subject
export const CreateSubjectSchema = z.object({
  editalId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional()
});

export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;

// Schema para criação de topic
export const CreateTopicSchema = z.object({
  subjectId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional().default(2),
  priority: z.number().int().min(1).max(10).optional().default(5)
});

export type CreateTopicInput = z.infer<typeof CreateTopicSchema>;

// Middleware para validação de request body
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

// Middleware para validação de query params
export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros inválidos',
          details: error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}
