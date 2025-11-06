import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// ========================================
// CATEGORIES
// ========================================

router.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM categories 
      WHERE is_active = true 
      ORDER BY display_order, name
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('[API] Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/api/categories', async (req, res) => {
  const { name, slug, icon, description, display_order } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO categories (name, slug, icon, description, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, slug, icon, description, display_order || 0]);
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('[API] Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, slug, icon, description, display_order, is_active } = req.body;
  try {
    const result = await pool.query(`
      UPDATE categories 
      SET name = COALESCE($1, name),
          slug = COALESCE($2, slug),
          icon = COALESCE($3, icon),
          description = COALESCE($4, description),
          display_order = COALESCE($5, display_order),
          is_active = COALESCE($6, is_active)
      WHERE id = $7
      RETURNING *
    `, [name, slug, icon, description, display_order, is_active, id]);
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('[API] Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ========================================
// CONTESTS
// ========================================

router.get('/api/contests', async (req, res) => {
  const { category_id } = req.query;
  try {
    let query = `
      SELECT c.*, cat.name as category_name
      FROM contests c
      LEFT JOIN categories cat ON c.category_id = cat.id
    `;
    const params: any[] = [];
    
    if (category_id) {
      query += ' WHERE c.category_id = $1';
      params.push(category_id);
    }
    
    query += ' ORDER BY c.exam_date DESC NULLS LAST, c.title';
    
    const result = await pool.query(query, params);
    res.json({ contests: result.rows });
  } catch (error) {
    console.error('[API] Error fetching contests:', error);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

router.post('/api/contests', async (req, res) => {
  const { category_id, title, slug, institution, exam_date, vacancies, salary, education_level, location, status, source_url, is_official } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO contests (category_id, title, slug, institution, exam_date, vacancies, salary, education_level, location, status, source_url, is_official)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [category_id, title, slug, institution, exam_date, vacancies, salary, education_level, location, status || 'active', source_url, is_official || false]);
    res.json({ contest: result.rows[0] });
  } catch (error) {
    console.error('[API] Error creating contest:', error);
    res.status(500).json({ error: 'Failed to create contest' });
  }
});

router.put('/api/contests/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    const result = await pool.query(`
      UPDATE contests SET ${fields} WHERE id = $${values.length + 1} RETURNING *
    `, [...values, id]);
    res.json({ contest: result.rows[0] });
  } catch (error) {
    console.error('[API] Error updating contest:', error);
    res.status(500).json({ error: 'Failed to update contest' });
  }
});

router.delete('/api/contests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM contests WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting contest:', error);
    res.status(500).json({ error: 'Failed to delete contest' });
  }
});

// ========================================
// EDITALS
// ========================================

router.get('/api/editals', async (req, res) => {
  const { contest_id } = req.query;
  try {
    let query = `
      SELECT e.*, c.title as contest_title,
             (SELECT COUNT(*) FROM subjects WHERE edital_id = e.id) as subjects_count
      FROM editals e
      LEFT JOIN contests c ON e.contest_id = c.id
    `;
    const params: any[] = [];
    
    if (contest_id) {
      query += ' WHERE e.contest_id = $1';
      params.push(contest_id);
    }
    
    query += ' ORDER BY e.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json({ editals: result.rows });
  } catch (error) {
    console.error('[API] Error fetching editals:', error);
    res.status(500).json({ error: 'Failed to fetch editals' });
  }
});

router.post('/api/editals', async (req, res) => {
  const { contest_id, title, edital_number, file_url, original_text, status } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO editals (contest_id, title, edital_number, file_url, original_text, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [contest_id, title, edital_number, file_url, original_text, status || 'pending']);
    res.json({ edital: result.rows[0] });
  } catch (error) {
    console.error('[API] Error creating edital:', error);
    res.status(500).json({ error: 'Failed to create edital' });
  }
});

router.put('/api/editals/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    const result = await pool.query(`
      UPDATE editals SET ${fields} WHERE id = $${values.length + 1} RETURNING *
    `, [...values, id]);
    res.json({ edital: result.rows[0] });
  } catch (error) {
    console.error('[API] Error updating edital:', error);
    res.status(500).json({ error: 'Failed to update edital' });
  }
});

router.delete('/api/editals/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM editals WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting edital:', error);
    res.status(500).json({ error: 'Failed to delete edital' });
  }
});

// ========================================
// SUBJECTS
// ========================================

router.get('/api/subjects', async (req, res) => {
  const { edital_id } = req.query;
  try {
    let query = `
      SELECT s.*, e.title as edital_title
      FROM subjects s
      LEFT JOIN editals e ON s.edital_id = e.id
    `;
    const params: any[] = [];
    
    if (edital_id) {
      query += ' WHERE s.edital_id = $1';
      params.push(edital_id);
    }
    
    query += ' ORDER BY s.display_order, s.name';
    
    const result = await pool.query(query, params);
    res.json({ subjects: result.rows });
  } catch (error) {
    console.error('[API] Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

router.post('/api/subjects', async (req, res) => {
  const { edital_id, name, slug, weight, difficulty, priority, color, display_order } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO subjects (edital_id, name, slug, weight, difficulty, priority, color, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [edital_id, name, slug, weight || 1, difficulty || 2, priority || 5, color, display_order || 0]);
    res.json({ subject: result.rows[0] });
  } catch (error) {
    console.error('[API] Error creating subject:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// ========================================
// TOPICS
// ========================================

router.get('/api/topics', async (req, res) => {
  const { subject_id } = req.query;
  try {
    let query = `
      SELECT t.*, s.name as subject_name
      FROM topics t
      LEFT JOIN subjects s ON t.subject_id = s.id
    `;
    const params: any[] = [];
    
    if (subject_id) {
      query += ' WHERE t.subject_id = $1';
      params.push(subject_id);
    }
    
    query += ' ORDER BY t.display_order, t.name';
    
    const result = await pool.query(query, params);
    res.json({ topics: result.rows });
  } catch (error) {
    console.error('[API] Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

router.post('/api/topics', async (req, res) => {
  const { subject_id, name, slug, description, difficulty, priority, estimated_concepts, display_order } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO topics (subject_id, name, slug, description, difficulty, priority, estimated_concepts, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [subject_id, name, slug, description, difficulty || 2, priority || 5, estimated_concepts || 10, display_order || 0]);
    res.json({ topic: result.rows[0] });
  } catch (error) {
    console.error('[API] Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// ========================================
// SUBTOPICS
// ========================================

router.get('/api/subtopics', async (req, res) => {
  const { topic_id } = req.query;
  try {
    let query = `
      SELECT st.*, t.name as topic_name
      FROM subtopics st
      LEFT JOIN topics t ON st.topic_id = t.id
    `;
    const params: any[] = [];
    
    if (topic_id) {
      query += ' WHERE st.topic_id = $1';
      params.push(topic_id);
    }
    
    query += ' ORDER BY st.display_order, st.name';
    
    const result = await pool.query(query, params);
    res.json({ subtopics: result.rows });
  } catch (error) {
    console.error('[API] Error fetching subtopics:', error);
    res.status(500).json({ error: 'Failed to fetch subtopics' });
  }
});

router.post('/api/subtopics', async (req, res) => {
  const { topic_id, name, slug, description, difficulty, priority, estimated_concepts, display_order } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO subtopics (topic_id, name, slug, description, difficulty, priority, estimated_concepts, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [topic_id, name, slug, description, difficulty || 2, priority || 5, estimated_concepts || 5, display_order || 0]);
    res.json({ subtopic: result.rows[0] });
  } catch (error) {
    console.error('[API] Error creating subtopic:', error);
    res.status(500).json({ error: 'Failed to create subtopic' });
  }
});

// ========================================
// STATS
// ========================================

router.get('/api/stats', async (req, res) => {
  try {
    const categoriesCount = await pool.query('SELECT COUNT(*) FROM categories WHERE is_active = true');
    const contestsCount = await pool.query('SELECT COUNT(*) FROM contests');
    const editalsCount = await pool.query('SELECT COUNT(*) FROM editals');
    const subjectsCount = await pool.query('SELECT COUNT(*) FROM subjects');
    const topicsCount = await pool.query('SELECT COUNT(*) FROM topics');
    const subtopicsCount = await pool.query('SELECT COUNT(*) FROM subtopics');
    
    res.json({
      categories: parseInt(categoriesCount.rows[0].count),
      contests: parseInt(contestsCount.rows[0].count),
      editals: parseInt(editalsCount.rows[0].count),
      subjects: parseInt(subjectsCount.rows[0].count),
      topics: parseInt(topicsCount.rows[0].count),
      subtopics: parseInt(subtopicsCount.rows[0].count),
    });
  } catch (error) {
    console.error('[API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
