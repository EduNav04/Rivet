// Configuration
const API_URL = "https://dflndnsl0g.execute-api.us-east-2.amazonaws.com";

// Validation in real-time
const jsonInput = document.getElementById('jsonInput');
jsonInput.addEventListener('input', validateJSON);

// Initial validation
validateJSON();

// Send POST request
async function sendPOST() {
  const output = document.getElementById('output');
  const jsonText = document.getElementById('jsonInput').value;
  const btn = event.target;

  // Validate JSON before sending
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (err) {
    output.textContent = '❌ JSON inválido en el textarea:\n\n' + err.message;
    output.className = 'error';
    console.error('JSON inválido:', err);
    return;
  }

  // Disable button and show loading
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';
  output.textContent = '⏳ Enviando petición al servidor...';
  output.className = '';

  try {
    console.log('📤 Enviando POST a /tools');
    console.log('📦 Payload:', payload);

    const res = await fetch(`${API_URL}/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 Respuesta recibida:', res.status, res.statusText);

    // Get response content
    const contentType = res.headers.get('content-type') || '';
    let bodyText;
    
    try {
      if (contentType.includes('application/json')) {
        const jsonResponse = await res.json();
        bodyText = JSON.stringify(jsonResponse, null, 2);
      } else {
        bodyText = await res.text();
      }
    } catch (e) {
      bodyText = '(no se pudo parsear body) ' + e.message;
    }

    // Format output
    const statusEmoji = res.ok ? '✅' : '❌';
    const outputText = `${statusEmoji} HTTP ${res.status} ${res.statusText}\n\n${bodyText}`;
    
    output.textContent = outputText;
    output.className = res.ok ? 'success' : 'error';
    
    console.log('POST respuesta:', res.status, res.statusText, bodyText);

    // If successful, clear the textarea
    if (res.ok) {
      setTimeout(() => {
        if (confirm('✅ Herramienta creada exitosamente.\n¿Deseas limpiar el formulario?')) {
          clearJSON();
        }
      }, 500);
    }

  } catch (err) {
    const errorText = `❌ Error de red:\n\n${err.message}`;
    output.textContent = errorText;
    output.className = 'error';
    console.error("Error en fetch POST:", err);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '📤 Enviar Herramienta';
  }
}

// Validate JSON in real-time
function validateJSON() {
  const jsonText = jsonInput.value.trim();
  const status = document.getElementById('validationStatus');
  
  if (!jsonText) {
    status.className = 'validation-status';
    status.innerHTML = '<span class="status-icon">⏳</span><span class="status-text">Sin validar</span>';
    return;
  }

  try {
    const parsed = JSON.parse(jsonText);
    
    // Validate required fields
    const errors = [];
    if (!parsed.toolId) errors.push('toolId es requerido');
    if (!parsed.name) errors.push('name es requerido');
    
    if (errors.length > 0) {
      status.className = 'validation-status invalid';
      status.innerHTML = `<span class="status-icon">⚠️</span><span class="status-text">Campos faltantes: ${errors.join(', ')}</span>`;
    } else {
      status.className = 'validation-status valid';
      status.innerHTML = '<span class="status-icon">✅</span><span class="status-text">JSON válido</span>';
    }
  } catch (err) {
    status.className = 'validation-status invalid';
    status.innerHTML = `<span class="status-icon">❌</span><span class="status-text">JSON inválido: ${err.message}</span>`;
  }
}

// Clear JSON textarea
function clearJSON() {
  jsonInput.value = '';
  document.getElementById('output').textContent = 'Esperando petición...';
  document.getElementById('output').className = '';
  validateJSON();
}

// Format JSON
function formatJSON() {
  const jsonText = jsonInput.value.trim();
  
  try {
    const parsed = JSON.parse(jsonText);
    jsonInput.value = JSON.stringify(parsed, null, 2);
    validateJSON();
  } catch (err) {
    alert('❌ No se puede formatear: JSON inválido\n\n' + err.message);
  }
}

// Load template
function loadTemplate(type) {
  const templates = {
    library: {
      toolId: "example-library",
      name: "Example Library",
      supportedPlatforms: ["Linux", "macOS", "Windows"],
      languageCompatibility: {
        "Python": [">=3.8", "<4.0"]
      },
      learningCurve: "beginner",
      documentationQuality: "high",
      categories: ["Development Tools"],
      predefinedComparisons: []
    }
  };

  const template = templates[type];
  if (template) {
    jsonInput.value = JSON.stringify(template, null, 2);
    validateJSON();
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S to format JSON
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    formatJSON();
  }
  
  // Ctrl/Cmd + Enter to send
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendPOST();
  }
});

console.log('🔒 Admin panel loaded');
console.log('💡 Atajos de teclado:');
console.log('   Ctrl/Cmd + S: Formatear JSON');
console.log('   Ctrl/Cmd + Enter: Enviar');
