const API_URL = "https://dflndnsl0g.execute-api.us-east-2.amazonaws.com";

let loadedTools = new Map(); 
let currentFilter = 'all';

// Initialize event listeners
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchTool();
  }
});

document.getElementById('searchBtn').addEventListener('click', searchTool);

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
    showError('Please enter a toolId');
    return;
  }

  if (loadedTools.has(toolId)) {
    showError('This tool is already loaded');
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
      const text = await res.text();
      console.log('📝 Respuesta cruda:', text);
      
      toolData = JSON.parse(text);
      console.log('✅ JSON parseado exitosamente:', toolData);
    } catch (e) {
      console.error('❌ Error al parsear JSON:', e);
      throw new Error('Error parsing response: ' + e.message);
    }

    if (res.status === 200 && toolData) {
      console.log('✅ Herramienta cargada correctamente');
      
      loadedTools.set(toolId, toolData);
      
      console.log('🔄 Cargando comparaciones...');
      await loadComparisons(toolData);
      
      updateCategories();
      updateToolChips();
      renderGraph();
      
      input.value = '';
      console.log('✨ Proceso completado');
    } else {
      console.error('❌ Status no es 200 o toolData es null');
      throw new Error(`Tool not found (HTTP ${res.status})`);
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
  container.innerHTML = '<div class="category-item active" data-category="all" onclick="filterByCategory(\'all\')">📊 All Tools</div>';
  
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

// Render graph - ONLY show the main node and its direct comparisons
function renderGraph() {
  const svg = d3.select("#graph");
  svg.selectAll("*").remove();

  const allTools = Array.from(loadedTools.values());

  if (allTools.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const mainTool = allTools[0]; 
  const mainToolId = mainTool.toolId;

  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  nodeMap.set(mainToolId, { 
    id: mainToolId, 
    name: mainTool.name || mainToolId, 
    ...mainTool,
    isMain: true 
  });
  nodes.push(nodeMap.get(mainToolId));

  if (mainTool.predefinedComparisons) {
    mainTool.predefinedComparisons.forEach(compId => {
      if (!nodeMap.has(compId)) {
        const compTool = loadedTools.get(compId);
        nodeMap.set(compId, { 
          id: compId, 
          name: compTool ? compTool.name : compId,
          ...(compTool || {}),
          isComparison: true
        });
        nodes.push(nodeMap.get(compId));
      }
      links.push({ source: mainToolId, target: compId });
    });
  }

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

  // Generate random color for each node
  const getNodeColor = (d) => {
    if (d.isComparison) return "#94a3b8"; 
    
    const colors = [
      "#6c8fff", "#ff6b9d", "#4ade80", "#fbbf24", 
      "#a78bfa", "#fb923c", "#38bdf8", "#f472b6",
      "#34d399", "#fcd34d", "#c084fc", "#60a5fa"
    ];
    
    // Use toolId to consistently assign the same color to the same tool
    const hash = d.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  node.append("circle")
    .attr("r", d => d.isComparison ? 25 : 35)
    .attr("fill", d => getNodeColor(d))
    .attr("stroke", d => d.isComparison ? "#2d3748" : "#4c6eef");

  // Add text inside the circle
  node.append("text")
    .attr("dy", 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#ffffff")
    .attr("font-size", d => d.isComparison ? "11px" : "13px")
    .attr("font-weight", "700")
    .text(d => {
      const name = d.name || d.id;
      // Truncate long names to fit inside circle
      return name.length > 8 ? name.substring(0, 7) + '...' : name;
    });

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
      html += `<p><strong>Categories:</strong> ${d.categories.join(', ')}</p>`;
    }
    if (d.supportedPlatforms) {
      html += `<p><strong>Supported Platforms:</strong> ${d.supportedPlatforms.join(', ')}</p>`;
    }
    if (d.learningCurve) {
      html += `<p><strong>Learning Curve:</strong> ${d.learningCurve}</p>`;
    }
    if (d.documentationQuality) {
      html += `<p><strong>Documentation Quality:</strong> ${d.documentationQuality}</p>`;
    }
    if (d.predefinedComparisons && d.predefinedComparisons.length > 0) {
      html += `<p><strong>Comparisons:</strong> ${d.predefinedComparisons.join(', ')}</p>`;
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
