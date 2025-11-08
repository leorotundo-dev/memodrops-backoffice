// ========================================
// SISTEMA DE ROTAS SPA
// ========================================

const routes = {
  dashboard: renderDashboard,
  hierarchy: renderHierarchy,
  institutions: renderInstitutions,
  harvester: renderHarvester,
  pipeline: renderPipeline,
  drops: renderDrops,
  users: renderUsers,
  pedagogy: renderPedagogy,
  rag: renderRAG,
  admin: renderAdmin
};

let currentRoute = 'dashboard';

function navigateTo(route) {
  currentRoute = route;
  
  // Atualizar sidebar
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  event?.target?.closest('.sidebar-item')?.classList.add('active');
  
  // Renderizar página
  if (routes[route]) {
    routes[route]();
  }
}

function refreshData() {
  if (routes[currentRoute]) {
    routes[currentRoute]();
  }
}

// ========================================
// DASHBOARD (HOME)
// ========================================

async function renderDashboard() {
  updatePageHeader('Dashboard', 'Visão geral do sistema');
  
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    const statusRes = await fetch('/api/process/status');
    const status = await statusRes.json();
    
    const html = `
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="stat-card">
          <div class="flex items-center justify-between mb-2">
            <span class="text-slate-500 text-sm">Total de Items</span>
            <span class="text-2xl">📊</span>
          </div>
          <div class="text-3xl font-bold text-slate-900">${status.total || 0}</div>
          <div class="text-xs text-slate-500 mt-1">Coletados</div>
        </div>
        
        <div class="stat-card">
          <div class="flex items-center justify-between mb-2">
            <span class="text-slate-500 text-sm">Processados</span>
            <span class="text-2xl">✅</span>
          </div>
          <div class="text-3xl font-bold text-green-600">${status.processed || 0}</div>
          <div class="text-xs text-slate-500 mt-1">${((status.processed / status.total) * 100).toFixed(1)}% do total</div>
        </div>
        
        <div class="stat-card">
          <div class="flex items-center justify-between mb-2">
            <span class="text-slate-500 text-sm">Aguardando</span>
            <span class="text-2xl">⏳</span>
          </div>
          <div class="text-3xl font-bold text-amber-600">${status.fetched || 0}</div>
          <div class="text-xs text-slate-500 mt-1">Prontos para processar</div>
        </div>
      </div>
      
      <!-- Chart -->
      <div class="card p-6 mb-8">
        <h3 class="text-lg font-semibold mb-4">Processamento por Fonte</h3>
        <canvas id="sourceChart" height="80"></canvas>
      </div>
      
      <!-- Recent Activity -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Atividade Recente</h3>
        <div class="space-y-3">
          <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <span class="text-2xl">✅</span>
            <div class="flex-1">
              <div class="font-medium">117 items processados com sucesso</div>
              <div class="text-sm text-slate-500">Há 2 horas</div>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <span class="text-2xl">🤖</span>
            <div class="flex-1">
              <div class="font-medium">Coleta automática executada</div>
              <div class="text-sm text-slate-500">Há 4 horas</div>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <span class="text-2xl">🔧</span>
            <div class="flex-1">
              <div class="font-medium">Melhorias de segurança implementadas</div>
              <div class="text-sm text-slate-500">Hoje</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    content.innerHTML = html;
    
    // Renderizar chart
    if (status.by_source) {
      renderSourceChart(status.by_source);
    }
  } catch (err) {
    content.innerHTML = '<div class="card p-6"><p class="text-red-600">Erro ao carregar dashboard</p></div>';
  }
}

function renderSourceChart(data) {
  const ctx = document.getElementById('sourceChart');
  if (!ctx) return;
  
  const labels = Object.keys(data);
  const values = Object.values(data);
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Items Processados',
        data: values,
        backgroundColor: '#3B82F6',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ========================================
// HARVESTER
// ========================================

async function renderHarvester() {
  updatePageHeader('Harvester', 'Coleta automática de editais');
  
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold">Adapters de Coleta</h3>
        <button onclick="runHarvest()" class="btn btn-primary">
          🤖 Executar Coleta Completa
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${renderAdapters()}
      </div>
    </div>
    
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Histórico de Coletas</h3>
      <div class="text-slate-500 text-center py-8">Nenhuma coleta recente</div>
    </div>
  `;
}

function renderAdapters() {
  const adapters = ['FGV', 'Quadrix', 'Cebraspe', 'FCC', 'Vunesp', 'PCI', 'Cesgranrio', 'IBADE', 'AOCP', 'ConcursosNoBrasil', 'Consulplan', 'FGD', 'gov.br', 'IBAM', 'IBFC', 'Idecan', 'MGI/CNPU', 'DOU', 'Planalto'];
  
  return adapters.map(name => `
    <div class="p-4 bg-slate-50 rounded-lg">
      <div class="flex items-center justify-between mb-2">
        <span class="font-medium">${name}</span>
        <span class="badge badge-success">● Ativo</span>
      </div>
      <div class="text-xs text-slate-500 mb-3">Última coleta: 2h atrás</div>
      <button onclick="runSingleAdapter('${name}')" class="btn btn-secondary btn-sm w-full">
        ▶️ Executar
      </button>
    </div>
  `).join('');
}

async function runHarvest() {
  if (!confirm('Executar coleta completa de todos os adapters?')) return;
  
  try {
    const res = await fetch('/api/harvest', { method: 'POST' });
    const result = await res.json();
    alert(`Coleta iniciada! ${result.message || ''}`);
    renderHarvester();
  } catch (err) {
    alert('Erro ao executar coleta: ' + err.message);
  }
}

// ========================================
// PIPELINE
// ========================================

async function renderPipeline() {
  updatePageHeader('Pipeline', 'Processamento de items coletados');
  
  const content = document.getElementById('content');
  
  try {
    const statusRes = await fetch('/api/process/status');
    const status = await statusRes.json();
    
    content.innerHTML = `
      <div class="card p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">Status do Processamento</h3>
          <div class="flex gap-3">
            <button onclick="runPipelineV2()" class="btn btn-primary">
              ⚙️ Pipeline V2 (HTML)
            </button>
            <button onclick="runPipelineV3()" class="btn btn-secondary">
              🚀 Pipeline V3 (Microserviços)
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-4 gap-4 mb-6">
          <div class="text-center p-4 bg-slate-50 rounded-lg">
            <div class="text-2xl font-bold text-slate-900">${status.total || 0}</div>
            <div class="text-sm text-slate-500">Total</div>
          </div>
          <div class="text-center p-4 bg-green-50 rounded-lg">
            <div class="text-2xl font-bold text-green-600">${status.processed || 0}</div>
            <div class="text-sm text-green-700">Processados</div>
          </div>
          <div class="text-center p-4 bg-amber-50 rounded-lg">
            <div class="text-2xl font-bold text-amber-600">${status.fetched || 0}</div>
            <div class="text-sm text-amber-700">Aguardando</div>
          </div>
          <div class="text-center p-4 bg-red-50 rounded-lg">
            <div class="text-2xl font-bold text-red-600">${status.error || 0}</div>
            <div class="text-sm text-red-700">Erros</div>
          </div>
        </div>
        
        ${status.fetched > 0 ? `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center gap-2 text-blue-700 mb-2">
              <span>ℹ️</span>
              <span class="font-medium">${status.fetched} items prontos para processar</span>
            </div>
            <div class="text-sm text-blue-600">Clique em um dos botões acima para iniciar o processamento</div>
          </div>
        ` : ''}
      </div>
      
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Items por Status</h3>
        <div class="space-y-2">
          ${Object.entries(status.by_status || {}).map(([st, count]) => `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span class="font-medium">${st}</span>
              <span class="badge badge-info">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = '<div class="card p-6"><p class="text-red-600">Erro ao carregar pipeline</p></div>';
  }
}

async function runPipelineV2() {
  if (!confirm('Processar items com Pipeline V2 (extração HTML)?')) return;
  
  try {
    const res = await fetch('/api/process/v2', { method: 'POST' });
    const result = await res.json();
    alert(`Pipeline V2 iniciado! ${result.message || ''}`);
    setTimeout(() => renderPipeline(), 2000);
  } catch (err) {
    alert('Erro ao executar pipeline: ' + err.message);
  }
}

async function runPipelineV3() {
  alert('Pipeline V3 com microserviços ainda não está disponível');
}

// ========================================
// DROPS & QA
// ========================================

async function renderDrops() {
  updatePageHeader('Drops & QA', 'Geração e qualidade de questões');
  
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    // Buscar estatísticas de drops (usar dados mockados se API não existir)
    let stats = { total: 0, approved: 0, needsReview: 0, rejected: 0 };
    
    try {
      const statsRes = await fetch('/api/drops/stats');
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch (err) {
      console.log('API drops/stats não disponível, usando dados mockados');
    }
    
    content.innerHTML = `
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Total de Drops</div>
          <div class="text-3xl font-bold text-slate-900">${stats.total || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Aprovados</div>
          <div class="text-3xl font-bold text-green-600">${stats.approved || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Em Revisão</div>
          <div class="text-3xl font-bold text-amber-600">${stats.needsReview || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Rejeitados</div>
          <div class="text-3xl font-bold text-red-600">${stats.rejected || 0}</div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="card p-6 mb-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Ações</h3>
          <div class="flex gap-3">
            <button onclick="generateDrops()" class="btn btn-primary">
              💡 Gerar Novos Drops
            </button>
            <button onclick="reviewDrops()" class="btn btn-secondary">
              ⚠️ Revisar Pendentes (${stats.needsReview || 0})
            </button>
          </div>
        </div>
      </div>
      
      <!-- Recent Drops -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Drops Recentes</h3>
        <div class="text-slate-500 text-center py-8">Carregando lista de drops...</div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Drops & QA</h3>
        <p class="text-slate-500">Sistema de drops disponível. Use os botões abaixo para gerenciar.</p>
        <div class="flex gap-3 mt-4">
          <button onclick="generateDrops()" class="btn btn-primary">💡 Gerar Drops</button>
          <button onclick="reviewDrops()" class="btn btn-secondary">⚠️ Revisar</button>
        </div>
      </div>
    `;
  }
}

async function generateDrops() {
  const subjectId = prompt('Digite o ID da matéria para gerar drops:');
  if (!subjectId) return;
  
  try {
    const res = await fetch('/api/drops/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: parseInt(subjectId) })
    });
    const result = await res.json();
    alert(`Drops gerados com sucesso! ${result.message || ''}`);
    renderDrops();
  } catch (err) {
    alert('Erro ao gerar drops: ' + err.message);
  }
}

function reviewDrops() {
  alert('Funcionalidade de revisão será implementada em breve');
}

// ========================================
// OUTRAS PÁGINAS (PLACEHOLDERS)
// ========================================

function renderHierarchy() {
  updatePageHeader('Hierarquia', 'Navegação hierárquica de conteúdo');
  window.location.href = '/dashboard/index.html';
}

async function renderInstitutions() {
  updatePageHeader('Bancas', 'Gestão de instituições organizadoras');
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    // Buscar instituições
    const res = await fetch('/api/institutions');
    const institutions = await res.json();
    
    content.innerHTML = `
      <div class="card p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">Instituições Organizadoras</h3>
          <button onclick="addInstitution()" class="btn btn-primary">
            + Nova Banca
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${institutions.map(inst => `
            <div class="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition cursor-pointer">
              <div class="text-2xl mb-2">🏛️</div>
              <div class="font-semibold">${inst.name || 'Sem nome'}</div>
              <div class="text-sm text-slate-500 mt-1">${inst.slug || ''}</div>
              <div class="text-xs text-slate-400 mt-2">${inst.contests_count || 0} concursos</div>
            </div>
          `).join('')}
        </div>
        
        ${institutions.length === 0 ? '<div class="text-center text-slate-500 py-8">Nenhuma banca cadastrada</div>' : ''}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Bancas</h3>
        <p class="text-slate-500">Erro ao carregar bancas.</p>
      </div>
    `;
  }
}

function addInstitution() {
  const name = prompt('Nome da banca:');
  if (!name) return;
  
  fetch('/api/institutions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  .then(() => {
    alert('Banca criada com sucesso!');
    renderInstitutions();
  })
  .catch(err => alert('Erro: ' + err.message));
}

async function renderUsers() {
  updatePageHeader('Usuários', 'Gestão de usuários e personalização');
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    // Buscar estatísticas de usuários
    let stats = { totalUsers: 0, activePlans: 0, dropsToday: 0, gaps: 0 };
    try {
      const statsRes = await fetch('/api/personalization/stats');
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch (err) {
      console.log('API personalization/stats não disponível');
    }
    
    content.innerHTML = `
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Total de Usuários</div>
          <div class="text-3xl font-bold text-slate-900">${stats.totalUsers || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Planos Ativos</div>
          <div class="text-3xl font-bold text-green-600">${stats.activePlans || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Drops Hoje</div>
          <div class="text-3xl font-bold text-blue-600">${stats.dropsToday || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Gaps Identificados</div>
          <div class="text-3xl font-bold text-amber-600">${stats.gaps || 0}</div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="card p-6 mb-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Ações</h3>
          <div class="flex gap-3">
            <button onclick="generateDailyPlans()" class="btn btn-primary">
              📅 Gerar Planos Diários
            </button>
            <button onclick="identifyGaps()" class="btn btn-secondary">
              🔍 Identificar Gaps
            </button>
          </div>
        </div>
      </div>
      
      <!-- User List -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Usuários Recentes</h3>
        <div class="text-slate-500 text-center py-8">Lista de usuários disponível via API</div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Usuários & Personalização</h3>
        <p class="text-slate-500">Sistema de personalização disponível.</p>
        <div class="flex gap-3 mt-4">
          <button onclick="generateDailyPlans()" class="btn btn-primary">📅 Gerar Planos</button>
          <button onclick="identifyGaps()" class="btn btn-secondary">🔍 Identificar Gaps</button>
        </div>
      </div>
    `;
  }
}

async function generateDailyPlans() {
  if (!confirm('Gerar planos diários para todos os usuários ativos?')) return;
  
  try {
    const res = await fetch('/api/personalization/generate-plans', { method: 'POST' });
    const result = await res.json();
    alert(`Planos gerados! ${result.message || ''}`);
    renderUsers();
  } catch (err) {
    alert('Erro ao gerar planos: ' + err.message);
  }
}

async function identifyGaps() {
  if (!confirm('Identificar gaps de conhecimento para todos os usuários?')) return;
  
  try {
    const res = await fetch('/api/personalization/identify-gaps', { method: 'POST' });
    const result = await res.json();
    alert(`Gaps identificados! ${result.message || ''}`);
    renderUsers();
  } catch (err) {
    alert('Erro ao identificar gaps: ' + err.message);
  }
}

async function renderPedagogy() {
  updatePageHeader('Pedagogia', 'Pré-requisitos e progressão');
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    // Buscar estatísticas pedagógicas
    let stats = { prerequisites: 0, weakTopics: 0, examLogs: 0 };
    try {
      const statsRes = await fetch('/api/pedagogy/stats');
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch (err) {
      console.log('API pedagogy/stats não disponível');
    }
    
    content.innerHTML = `
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Pré-requisitos</div>
          <div class="text-3xl font-bold text-slate-900">${stats.prerequisites || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Tópicos Fracos</div>
          <div class="text-3xl font-bold text-red-600">${stats.weakTopics || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Logs de Exames</div>
          <div class="text-3xl font-bold text-blue-600">${stats.examLogs || 0}</div>
        </div>
      </div>
      
      <!-- Grafo de Pré-requisitos -->
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">🎓 Grafo de Pré-requisitos</h3>
        <div class="bg-slate-50 rounded-lg p-8 text-center">
          <div class="text-slate-500">Visualização do grafo de dependências</div>
          <div class="text-sm text-slate-400 mt-2">Implementar com D3.js ou Cytoscape.js</div>
        </div>
      </div>
      
      <!-- Tópicos Fracos -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">🔴 Tópicos Fracos</h3>
        <div class="text-slate-500 text-center py-8">Lista de tópicos com baixo desempenho</div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Pedagogia</h3>
        <p class="text-slate-500">Sistema pedagógico com pré-requisitos e progressão disponível.</p>
      </div>
    `;
  }
}

async function renderRAG() {
  updatePageHeader('RAG', 'Base de conhecimento e busca semântica');
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    // Buscar estatísticas de RAG
    let stats = { totalBlocks: 0, embeddings: 0, avgQuality: 0 };
    try {
      const statsRes = await fetch('/api/rag/stats');
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch (err) {
      console.log('API rag/stats não disponível');
    }
    
    content.innerHTML = `
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Blocos de Conhecimento</div>
          <div class="text-3xl font-bold text-slate-900">${stats.totalBlocks || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Embeddings</div>
          <div class="text-3xl font-bold text-blue-600">${stats.embeddings || 0}</div>
        </div>
        <div class="stat-card">
          <div class="text-slate-500 text-sm mb-2">Quality Score Médio</div>
          <div class="text-3xl font-bold text-green-600">${stats.avgQuality?.toFixed(1) || 0}</div>
        </div>
      </div>
      
      <!-- Busca Semântica -->
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">🔍 Busca Semântica</h3>
        <div class="flex gap-3">
          <input 
            type="text" 
            id="rag-search-input" 
            placeholder="Digite sua busca..." 
            class="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onclick="searchRAG()" class="btn btn-primary">
            🔍 Buscar
          </button>
        </div>
        <div id="rag-results" class="mt-4"></div>
      </div>
      
      <!-- Ações -->
      <div class="card p-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Ações</h3>
          <div class="flex gap-3">
            <button onclick="ingestContent()" class="btn btn-primary">
              📚 Ingerir Conteúdo
            </button>
            <button onclick="generateEmbeddings()" class="btn btn-secondary">
              🧠 Gerar Embeddings
            </button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">RAG & Base de Conhecimento</h3>
        <p class="text-slate-500">Sistema RAG disponível para busca semântica.</p>
        <div class="flex gap-3 mt-4">
          <input 
            type="text" 
            id="rag-search-input" 
            placeholder="Digite sua busca..." 
            class="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
          />
          <button onclick="searchRAG()" class="btn btn-primary">🔍 Buscar</button>
        </div>
        <div id="rag-results" class="mt-4"></div>
      </div>
    `;
  }
}

async function searchRAG() {
  const input = document.getElementById('rag-search-input');
  const query = input?.value;
  
  if (!query) {
    alert('Digite uma busca');
    return;
  }
  
  const resultsDiv = document.getElementById('rag-results');
  resultsDiv.innerHTML = '<div class="text-center text-slate-500 py-4">Buscando...</div>';
  
  try {
    const res = await fetch('/api/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const results = await res.json();
    
    if (results.length === 0) {
      resultsDiv.innerHTML = '<div class="text-center text-slate-500 py-4">Nenhum resultado encontrado</div>';
      return;
    }
    
    resultsDiv.innerHTML = results.map(r => `
      <div class="p-4 bg-slate-50 rounded-lg mb-2">
        <div class="font-medium">${r.title || 'Sem título'}</div>
        <div class="text-sm text-slate-600 mt-1">${r.content?.substring(0, 200) || ''}...</div>
        <div class="text-xs text-slate-400 mt-2">Score: ${r.score?.toFixed(2) || 0}</div>
      </div>
    `).join('');
  } catch (err) {
    resultsDiv.innerHTML = `<div class="text-red-600 py-4">Erro: ${err.message}</div>`;
  }
}

async function ingestContent() {
  if (!confirm('Ingerir conteúdo dos editais processados?')) return;
  
  try {
    const res = await fetch('/api/rag/ingest', { method: 'POST' });
    const result = await res.json();
    alert(`Conteúdo ingerido! ${result.message || ''}`);
    renderRAG();
  } catch (err) {
    alert('Erro ao ingerir conteúdo: ' + err.message);
  }
}

async function generateEmbeddings() {
  if (!confirm('Gerar embeddings para todos os blocos de conhecimento?')) return;
  
  try {
    const res = await fetch('/api/rag/embeddings', { method: 'POST' });
    const result = await res.json();
    alert(`Embeddings gerados! ${result.message || ''}`);
    renderRAG();
  } catch (err) {
    alert('Erro ao gerar embeddings: ' + err.message);
  }
}

async function renderAdmin() {
  updatePageHeader('Administração', 'Migrações, custos e logs');
  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center text-slate-500 py-8">Carregando...</div>';
  
  try {
    // Buscar métricas de custo
    const costsRes = await fetch('/api/costs/metrics');
    const costs = await costsRes.json();
    
    // Buscar erros recentes (usar array vazio se API não existir)
    let errors = [];
    try {
      const errorsRes = await fetch('/api/errors/recent?limit=5');
      if (errorsRes.ok) {
        errors = await errorsRes.json();
      }
    } catch (err) {
      console.log('API errors/recent não disponível');
    }
    
    content.innerHTML = `
      <!-- Custos -->
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">💰 Custos Operacionais</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div class="text-sm text-slate-500 mb-1">OpenAI</div>
            <div class="text-2xl font-bold text-slate-900">R$ ${costs.openai?.estimatedCost?.toFixed(2) || '0.00'}</div>
            <div class="text-xs text-slate-400">${costs.openai?.tokensUsed?.toLocaleString() || 0} tokens</div>
          </div>
          <div>
            <div class="text-sm text-slate-500 mb-1">Railway</div>
            <div class="text-2xl font-bold text-slate-900">${costs.railway?.plan || 'Hobby'}</div>
            <div class="text-xs text-slate-400">$${costs.railway?.monthlyLimit || 5}/mês</div>
          </div>
          <div>
            <div class="text-sm text-slate-500 mb-1">Storage</div>
            <div class="text-2xl font-bold text-slate-900">${costs.storage?.database?.toFixed(1) || 0} MB</div>
            <div class="text-xs text-slate-400">Banco de dados</div>
          </div>
        </div>
      </div>
      
      <!-- Banco de Dados -->
      <div class="card p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">🗄️ Banco de Dados</h3>
          <button onclick="runMigrations()" class="btn btn-secondary btn-sm">
            🔄 Executar Migrações
          </button>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">Tamanho</div>
            <div class="text-xl font-bold">${costs.storage?.database?.toFixed(1) || 0} MB</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">Índices</div>
            <div class="text-xl font-bold">171</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">Migrações</div>
            <div class="text-xl font-bold">12</div>
          </div>
        </div>
      </div>
      
      <!-- Erros Recentes -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">⚠️ Erros Recentes</h3>
        ${errors.length > 0 ? `
          <div class="space-y-2">
            ${errors.map(err => `
              <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div class="font-medium text-red-900">${err.message || 'Erro desconhecido'}</div>
                <div class="text-sm text-red-600 mt-1">${err.source || 'Sistema'} • ${new Date(err.created_at).toLocaleString('pt-BR')}</div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="text-center text-slate-500 py-8">✅ Nenhum erro recente</div>'}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Administração</h3>
        <p class="text-slate-500">Erro ao carregar dados administrativos.</p>
      </div>
    `;
  }
}

async function runMigrations() {
  if (!confirm('Executar migrações pendentes do banco de dados?')) return;
  
  try {
    const res = await fetch('/api/admin/migrations/run', { method: 'POST' });
    const result = await res.json();
    alert(`Migrações executadas! ${result.message || ''}`);
    renderAdmin();
  } catch (err) {
    alert('Erro ao executar migrações: ' + err.message);
  }
}

// ========================================
// HELPERS
// ========================================

function updatePageHeader(title, subtitle) {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
}

// ========================================
// INIT
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  navigateTo('dashboard');
});
