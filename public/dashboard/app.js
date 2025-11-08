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

function renderDrops() {
  updatePageHeader('Drops & QA', 'Geração e qualidade de questões');
  
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Em Desenvolvimento</h3>
      <p class="text-slate-500">Funcionalidade de Drops & QA será implementada em breve.</p>
    </div>
  `;
}

// ========================================
// OUTRAS PÁGINAS (PLACEHOLDERS)
// ========================================

function renderHierarchy() {
  updatePageHeader('Hierarquia', 'Navegação hierárquica de conteúdo');
  window.location.href = '/dashboard/index.html';
}

function renderInstitutions() {
  updatePageHeader('Bancas', 'Gestão de instituições organizadoras');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Em Desenvolvimento</h3>
      <p class="text-slate-500">Funcionalidade de Bancas será implementada em breve.</p>
    </div>
  `;
}

function renderUsers() {
  updatePageHeader('Usuários', 'Gestão de usuários e personalização');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Em Desenvolvimento</h3>
      <p class="text-slate-500">Funcionalidade de Usuários será implementada em breve.</p>
    </div>
  `;
}

function renderPedagogy() {
  updatePageHeader('Pedagogia', 'Pré-requisitos e progressão');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Em Desenvolvimento</h3>
      <p class="text-slate-500">Funcionalidade de Pedagogia será implementada em breve.</p>
    </div>
  `;
}

function renderRAG() {
  updatePageHeader('RAG', 'Base de conhecimento e busca semântica');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Em Desenvolvimento</h3>
      <p class="text-slate-500">Funcionalidade de RAG será implementada em breve.</p>
    </div>
  `;
}

function renderAdmin() {
  updatePageHeader('Administração', 'Migrações, custos e logs');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">Em Desenvolvimento</h3>
      <p class="text-slate-500">Funcionalidade de Administração será implementada em breve.</p>
    </div>
  `;
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
