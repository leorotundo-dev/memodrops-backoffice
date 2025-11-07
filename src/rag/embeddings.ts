import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class EmbeddingsService {
  /**
   * Gera embedding para um texto usando text-embedding-3-small
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error: any) {
      console.error('[Embeddings] Erro ao gerar embedding:', error);
      throw new Error(`Falha ao gerar embedding: ${error.message}`);
    }
  }

  /**
   * Gera embeddings para múltiplos textos em batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float'
      });

      return response.data.map(item => item.embedding);
    } catch (error: any) {
      console.error('[Embeddings] Erro ao gerar embeddings em batch:', error);
      throw new Error(`Falha ao gerar embeddings: ${error.message}`);
    }
  }

  /**
   * Calcula similaridade de cosseno entre dois embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings devem ter o mesmo tamanho');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Encontra os N textos mais similares a um embedding de referência
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidates: Array<{ text: string; embedding: number[] }>,
    topN: number = 5
  ): Array<{ text: string; similarity: number }> {
    const similarities = candidates.map(candidate => ({
      text: candidate.text,
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN);
  }
}
