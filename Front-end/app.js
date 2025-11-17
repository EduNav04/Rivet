// Configuration
const API_URL = "https://dflndnsl0g.execute-api.us-east-2.amazonaws.com";

// Global state
let loadedTools = new Map(); // toolId -> tool data
let currentFilter = 'all';

// Initialize event listeners
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchTool();
  }
});

document.getElementById('searchBtn').addEventListener('click', searchTool);

// Close info panel when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.node') && !e.target.closest('.info-panel')) {
    document.getElementById('infoPanel').classList.remove('visible');
  }
});

// Search tool
async function searchTool() {
  const input = document.getElementById('searchInput');
  const toolId = input.value.trim();
  
  if (!toolId) {
    showError('Por favor ingresa un toolId');
    return;
  }

  // Si ya está cargada, solo mostrar el grafo
  if (loadedTools.has(toolId)) {
    showError('Esta herramienta ya está cargada');
    return;
  }

  showLoading(true);
  hideError();
  hideEmptyState();

  try {
    console.log('🔍 Buscando herramienta:', toolId);
    console.log('📡 URL:', `${API_URL}/tools/${encodeURIComponent(toolId)}`);
    
    const res = await fetch(`${API_URL}/tools/${encodeURIComponent(toolId)}`);
    
    console.log('📥 Respuesta recibida:', {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    });
    
    const contentType = res.headers.get('content-type') || '';
    console.log('📄 Content-Type:', contentType);
    
    let toolData;
    
    try {
      // Primero obtener el texto completo
      const text = await res.text();
      console.log('📝 Respuesta cruda:', text);
      
      // Intentar parsear como JSON
      toolData = JSON.parse(text);
      console.log('✅ JSON parseado exitosamente:', toolData);
    } catch (e) {
      console.error('❌ Error al parsear JSON:', e);
      throw new Error('Error al parsear respuesta: ' + e.message);
    }

    if (res.status === 200 && toolData) {
      console.log('✅ Herramienta cargada correctamente');
      
      // Agregar a herramientas cargadas
      loadedTools.set(toolId, toolData);
      
      // Buscar comparaciones automáticamente
      console.log('🔄 Cargando comparaciones...');
      await loadComparisons(toolData);
      
      // Actualizar UI
      updateCategories();
      updateToolChips();
      renderGraph();
      
      input.value = '';
      console.log('✨ Proceso completado');
    } else {
      console.error('❌ Status no es 200 o toolData es null');
      throw new Error(`Herramienta no encontrada (HTTP ${res.status})`);
    }
  } catch (err) {
    console.error('💥 Error en búsqueda:', err);
    showError('Error: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// Load comparisons automatically
async function loadComparisons(tool) {
  if (!tool.predefinedComparisons || tool.predefinedComparisons.length === 0) {
    console.log('ℹ️ No hay comparaciones predefinidas para cargar');
    return;
  }

  console.log('🔄 Comparaciones a buscar:', tool.predefinedComparisons);
  
  const toLoad = tool.predefinedComparisons.filter(compId => !loadedTools.has(compId));
  console.log('📋 Comparaciones nuevas a cargar:', toLoad);

  const promises = toLoad.map(async (compId) => {
    try {
      console.log(`🔍 Buscando comparación: ${compId}`);
      const res = await fetch(`${API_URL}/tools/${encodeURIComponent(compId)}`);
      console.log(`📥 Respuesta para ${compId}:`, res.status);
      
      if (res.status === 200) {
        const text = await res.text();
        const data = JSON.parse(text);
        loadedTools.set(compId, data);
        console.log(`✅ ${compId} cargado correctamente`);
      } else {
        console.warn(`⚠️ ${compId} no encontrado (${res.status})`);
      }
    } catch (err) {
      console.warn(`❌ Error cargando ${compId}:`, err);
    }
  });

  await Promise.all(promises);
  console.log('✅ Todas las comparaciones procesadas');
}

// Update categories from loaded tools
function updateCategories() {
  const categories = new Set();
  loadedTools.forEach(tool => {
    if (tool.categories) {
      tool.categories.forEach(cat => categories.add(cat));
    }
  });

  const container = document.getElementById('categories');
  // Keep "all" category
  container.innerHTML = '<div class="category-item active" data-category="all">📊 Todas las herramientas</div>';
  
  Array.from(categories).sort().forEach(cat => {
    const div = document.createElement('div');
    div.className = 'category-item';
    div.textContent = cat;
    div.dataset.category = cat;
    div.onclick = () => filterByCategory(cat);
    container.appendChild(div);
  });
}

// Update tool chips
function updateToolChips() {
  const container = document.getElementById('toolChips');
  const wrapper = document.getElementById('loadedTools');
  
  if (loadedTools.size === 0) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = 'block';
  container.innerHTML = '';
  
  loadedTools.forEach((tool, toolId) => {
    const chip = document.createElement('div');
    chip.className = 'tool-chip';
    chip.innerHTML = `${tool.name || toolId} <span class="close">×</span>`;
    chip.onclick = (e) => {
      if (e.target.className === 'close') {
        removeTool(toolId);
      }
    };
    container.appendChild(chip);
  });
}

// Remove tool
function removeTool(toolId) {
  loadedTools.delete(toolId);
  updateCategories();
  updateToolChips();
  
  if (loadedTools.size === 0) {
    showEmptyState();
  } else {
    renderGraph();
  }
}

// Filter by category
function filterByCategory(category) {
  currentFilter = category;
  
  document.querySelectorAll('.category-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.category === category) {
      item.classList.add('active');
    }
  });

  renderGraph();
}

// Render graph
function renderGraph() {
  const svg = d3.select("#graph");
  svg.selectAll("*").remove();

  // Filter tools by category
  let toolsToShow = Array.from(loadedTools.values());
  if (currentFilter !== 'all') {
    toolsToShow = toolsToShow.filter(tool => 
      tool.categories && tool.categories.includes(currentFilter)
    );
  }

  if (toolsToShow.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  // Create nodes and links
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  toolsToShow.forEach(tool => {
    const toolId = tool.toolId;
    if (!nodeMap.has(toolId)) {
      nodeMap.set(toolId, { 
        id: toolId, 
        name: tool.name || toolId, 
        ...tool,
        isMain: true 
      });
      nodes.push(nodeMap.get(toolId));
    }

    if (tool.predefinedComparisons) {
      tool.predefinedComparisons.forEach(compId => {
        // Add comparison node
        if (!nodeMap.has(compId)) {
          const compTool = loadedTools.get(compId);
          nodeMap.set(compId, { 
            id: compId, 
            name: compTool ? compTool.name : compId,
            ...(compTool || {}),
            isComparison: !compTool
          });
          nodes.push(nodeMap.get(compId));
        }
        links.push({ source: toolId, target: compId });
      });
    }
  });

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-800))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(50));

  // Create links
  const link = svg.append("g")
    .selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("class", "link");

  // Create nodes
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended))
    .on("click", showInfo);

  node.append("circle")
    .attr("r", d => d.isComparison ? 25 : 35)
    .attr("fill", d => d.isComparison ? "#4a5568" : "#6c8fff")
    .attr("stroke", d => d.isComparison ? "#2d3748" : "#4c6eef");

  node.append("text")
    .attr("dy", d => d.isComparison ? 45 : 55)
    .attr("text-anchor", "middle")
    .attr("fill", "#e0e0e0")
    .text(d => d.name || d.id);

  // Update positions
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Show info panel
  function showInfo(event, d) {
    const panel = document.getElementById('infoPanel');
    const title = document.getElementById('infoTitle');
    const content = document.getElementById('infoContent');

    title.textContent = d.name || d.id;
    
    let html = `<p><strong>ID:</strong> ${d.id}</p>`;
    if (d.categories) {
      html += `<p><strong>Categorías:</strong> ${d.categories.join(', ')}</p>`;
    }
    if (d.supportedPlatforms) {
      html += `<p><strong>Plataformas:</strong> ${d.supportedPlatforms.join(', ')}</p>`;
    }
    if (d.learningCurve) {
      html += `<p><strong>Curva de aprendizaje:</strong> ${d.learningCurve}</p>`;
    }
    if (d.documentationQuality) {
      html += `<p><strong>Calidad documentación:</strong> ${d.documentationQuality}</p>`;
    }
    if (d.predefinedComparisons && d.predefinedComparisons.length > 0) {
      html += `<p><strong>Comparaciones:</strong> ${d.predefinedComparisons.join(', ')}</p>`;
    }
    
    content.innerHTML = html;
    panel.classList.add('visible');
  }
}

// UI Helper functions
function showLoading(show) {
  document.getElementById('loading').classList.toggle('visible', show);
  document.getElementById('searchBtn').disabled = show;
}

function showError(message) {
  const error = document.getElementById('errorMessage');
  error.textContent = message;
  error.classList.add('visible');
  setTimeout(() => hideError(), 4000);
}

function hideError() {
  document.getElementById('errorMessage').classList.remove('visible');
}

function showEmptyState() {
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('graph').style.display = 'none';
}

function hideEmptyState() {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('graph').style.display = 'block';
}
